import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisThrottlerStorageService } from './redis-throttler-storage.service';

/**
 * Rodada 165: limites próprios das rotas `dispositivo/*` (app do motorista
 * e do ajudante), além do limite global por IP.
 *
 * 1) FALHAS de autenticação do dispositivo (chave/uuid errados, aparelho
 *    não vinculado): contadas por IP e por par (identidade + IP). Passou do
 *    limite, o IP fica bloqueado por 15 min (HTTP 429), mesmo com a chave
 *    certa depois. De propósito NÃO bloqueia a conta inteira por
 *    identidade: o id do motorista aparece em cabeçalho, então um
 *    atacante poderia travar um motorista real só errando a chave dele
 *    (negação de serviço). A chave tem 256 bits aleatórios; o objetivo
 *    aqui é cortar varredura/abuso, não proteger de adivinhação.
 * 2) Volume de uso por APARELHO autenticado: teto por identidade/minuto,
 *    independente do IP (vários motoristas na mesma operadora móvel
 *    dividem IP; o limite global por IP sozinho pune os inocentes).
 *
 * Tudo usa o `RedisThrottlerStorageService` (Lua atômico, com fallback em
 * memória local se o Redis cair, então o limite NUNCA deixa de valer).
 */
@Injectable()
export class DeviceAuthLimiterService {
  private static readonly JANELA_FALHAS_MS = 15 * 60_000;
  private static readonly LIMITE_FALHAS_IP = 30;
  private static readonly LIMITE_FALHAS_IDENTIDADE_IP = 10;
  private static readonly BLOQUEIO_MS = 15 * 60_000;

  private readonly limiteUsoPorMinuto = Number(
    process.env.DEVICE_RATE_LIMIT_PER_MIN ?? 120,
  );

  constructor(private readonly storage: RedisThrottlerStorageService) {}

  private erro429(segundos: number): HttpException {
    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
        retryAfterSeconds: segundos,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /** Antes de autenticar: lança 429 se o IP já está bloqueado por falhas. */
  async exigirNaoBloqueado(ip: string): Promise<void> {
    const s = await this.storage.segundosBloqueado(ip, 'dispositivo-falha-ip');
    if (s > 0) throw this.erro429(s);
  }

  /** Após uma falha de autenticação. */
  async registrarFalha(ip: string, identidadeBruta: string): Promise<void> {
    const identidade = identidadeBruta.slice(0, 64); // id vem de cabeçalho: limita o tamanho da chave
    await this.storage.increment(
      ip,
      DeviceAuthLimiterService.JANELA_FALHAS_MS,
      DeviceAuthLimiterService.LIMITE_FALHAS_IP,
      DeviceAuthLimiterService.BLOQUEIO_MS,
      'dispositivo-falha-ip',
    );
    await this.storage.increment(
      `${identidade}|${ip}`,
      DeviceAuthLimiterService.JANELA_FALHAS_MS,
      DeviceAuthLimiterService.LIMITE_FALHAS_IDENTIDADE_IP,
      DeviceAuthLimiterService.BLOQUEIO_MS,
      'dispositivo-falha-id',
    );
  }

  /** Após autenticar com sucesso: teto de uso por aparelho/minuto (429 se passar). */
  async limitarUso(identidade: string): Promise<void> {
    const r = await this.storage.increment(
      identidade,
      60_000,
      this.limiteUsoPorMinuto,
      60_000,
      'dispositivo-uso',
    );
    if (r.isBlocked) throw this.erro429(Math.max(r.timeToBlockExpire, 1));
  }
}
