import { Injectable, Logger } from '@nestjs/common';
import { RedisThrottlerStorageService } from './redis-throttler-storage.service';

/**
 * Proteção contra ataque DISTRIBUÍDO (IP rotativo), que o limite por IP não
 * pega:
 *
 * 1) Limite por IDENTIDADE (ex.: e-mail), independente do IP: 100 IPs
 *    diferentes pedindo "esqueci a senha" para a mesma vítima contam juntos.
 * 2) Contador GLOBAL de falhas de login (todas as contas, todos os IPs). Se
 *    passar do teto numa janela de 5 min, entra em "modo defesa" por 10 min:
 *    cada tentativa falha de login passa a demorar alguns segundos, o que
 *    inviabiliza varredura em massa (credential stuffing/password spraying)
 *    sem trancar usuário legítimo, e o evento vai para o log de erro.
 *
 * Usa o mesmo storage (Redis com fallback local) do rate limit.
 */
@Injectable()
export class AbuseGuardService {
  private readonly logger = new Logger(AbuseGuardService.name);
  private ultimoAvisoDefesaMs = 0;

  private readonly tetoFalhasGlobais = Number(
    process.env.LOGIN_FALHAS_GLOBAIS_5MIN ?? 100,
  );
  private static readonly JANELA_GLOBAL_MS = 5 * 60_000;
  private static readonly DEFESA_MS = 10 * 60_000;
  private static readonly ATRASO_DEFESA_MS = 3_000;

  constructor(private readonly storage: RedisThrottlerStorageService) {}

  /**
   * Conta uma ocorrência para a identidade; devolve false quando passou do
   * limite na janela (o chamador decide como reagir, sem revelar nada).
   */
  async permitirPorIdentidade(
    namespace: string,
    identidadeBruta: string,
    limite: number,
    janelaMs: number,
  ): Promise<boolean> {
    const identidade = identidadeBruta.toLowerCase().trim().slice(0, 254);
    const r = await this.storage.increment(
      identidade,
      janelaMs,
      limite,
      janelaMs,
      `abuso-id-${namespace}`,
    );
    return !r.isBlocked;
  }

  /** Chamar a cada falha de login (qualquer conta, qualquer IP). */
  async registrarFalhaGlobalDeLogin(): Promise<void> {
    const r = await this.storage.increment(
      'global',
      AbuseGuardService.JANELA_GLOBAL_MS,
      this.tetoFalhasGlobais,
      AbuseGuardService.DEFESA_MS,
      'login-falhas-globais',
    );
    if (
      r.isBlocked &&
      Date.now() - this.ultimoAvisoDefesaMs > AbuseGuardService.DEFESA_MS
    ) {
      this.ultimoAvisoDefesaMs = Date.now();
      this.logger.error(
        `ATAQUE DISTRIBUÍDO SUSPEITO: mais de ${this.tetoFalhasGlobais} falhas de login em 5 min (todas as contas/IPs). Modo defesa ativo por 10 min: tentativas falhas passam a ser atrasadas.`,
      );
    }
  }

  async emModoDefesa(): Promise<boolean> {
    return (
      (await this.storage.segundosBloqueado('global', 'login-falhas-globais')) >
      0
    );
  }

  /** Atraso aplicado a tentativas falhas durante o modo defesa. */
  async atrasarSeEmDefesa(): Promise<void> {
    if (await this.emModoDefesa()) {
      await new Promise((r) =>
        setTimeout(r, AbuseGuardService.ATRASO_DEFESA_MS),
      );
    }
  }
}
