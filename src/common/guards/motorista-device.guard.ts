import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMITIR_SEM_CIENCIA_KEY } from '../decorators/permitir-sem-ciencia.decorator';
import {
  TipoDocumentoPrivacidade,
} from '@prisma/client';
import { VERSAO_DOCUMENTOS } from '../../privacidade/privacidade.textos';
import { createHash, timingSafeEqual } from 'crypto';
import {
  conferirChaveDispositivo,
  hashChaveDispositivo,
} from '../crypto/device-key-hash.util';
import { DeviceAuthLimiterService } from '../throttler/device-auth-limiter.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant-context';

/**
 * Autenticação + device binding do app do motorista.
 *
 * Três credenciais são exigidas juntas:
 *   X-Motorista-Id  → quem é
 *   X-Device-Key    → segredo do vínculo (equivalente a uma senha/API key)
 *   X-Device-Uuid   → identificador do aparelho físico
 *
 * Um motorista só tem UM vínculo de dispositivo ATIVO por vez (trocar de
 * aparelho substitui o vínculo anterior , igual senha, sem histórico).
 * Se o X-Device-Uuid não bater com o aparelho vinculado, a requisição é
 * rejeitada AQUI, antes de tocar qualquer rota , ou seja, "o login nem dá
 * certo" para um aparelho diferente do vinculado, mesmo que ele tenha
 * (por algum vazamento) a X-Device-Key correta.
 */
@Injectable()
export class MotoristaDeviceGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: DeviceAuthLimiterService,
    @Optional() private readonly reflector?: Reflector,
  ) {}

  /** Ciência é permanente para uma versão: guarda só os "sim" (chave inclui a versão). */
  private static readonly cienciasConfirmadas = new Set<string>();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip: string = request.ip ?? 'desconhecido';
    // Rodada 165: IP já bloqueado por falhas anteriores nem chega a autenticar (429).
    await this.limiter.exigirNaoBloqueado(ip);
    const motoristaId = request.headers['x-motorista-id'];
    const deviceKey = request.headers['x-device-key'];
    const deviceUuid = request.headers['x-device-uuid'];

    if (
      !motoristaId ||
      !deviceKey ||
      !deviceUuid ||
      typeof motoristaId !== 'string' ||
      typeof deviceKey !== 'string' ||
      typeof deviceUuid !== 'string'
    ) {
      await this.limiter.registrarFalha(ip, 'sem-credenciais');
      throw new UnauthorizedException('Credenciais de dispositivo ausentes');
    }

    // `empresa.grupoId` é buscado aqui pra alimentar o TenantContext
    // (RLS , Rodada 23): esta requisição é sempre a de UM motorista
    // específico (nunca cross-tenant), então o grupo dele é o contexto
    // certo pra ela inteira.
    // Roda como SISTEMA (RLS , Rodada 23): guards executam ANTES do
    // TenantContextInterceptor, então ainda não há grupo estabelecido
    // neste ponto , é a mesma situação do login por e-mail (Rodada 6),
    // só que aqui a "chave de busca" é o motoristaId do header.
    const motorista = await TenantContext.paraSistema(() =>
      this.prisma.motorista.findUnique({
        where: { id: motoristaId },
        include: {
          dispositivoVinculado: true,
          empresa: { select: { grupoId: true } },
        },
      }),
    );

    if (
      !motorista ||
      motorista.status !== 'ATIVO' ||
      !motorista.dispositivoVinculado
    ) {
      await this.limiter.registrarFalha(ip, motoristaId);
      throw new UnauthorizedException('Dispositivo não autorizado');
    }

    const vinculo = motorista.dispositivoVinculado;

    // Comparações em tempo constante: não vazar, pela diferença de tempo
    // de resposta, quantos bytes de cada credencial estão certos.
    const uuidRecebido = createHash('sha256').update(deviceUuid).digest();
    const uuidVinculado = createHash('sha256')
      .update(vinculo.deviceUuid)
      .digest();
    const uuidOk = timingSafeEqual(uuidRecebido, uuidVinculado);

    const { ok: chaveOk, precisaMigrar } = conferirChaveDispositivo(
      deviceKey,
      vinculo.deviceApiKeyHash,
    );

    if (!uuidOk || !chaveOk) {
      await this.limiter.registrarFalha(ip, motoristaId);
      throw new UnauthorizedException('Dispositivo não autorizado');
    }

    // Rodada 165: hash antigo (SHA-256 simples) vira HMAC no primeiro acesso
    // válido. Falha aqui nunca derruba a requisição (tenta de novo no próximo).
    if (precisaMigrar) {
      void TenantContext.paraSistema(() =>
        this.prisma.dispositivoVinculado.update({
          where: { id: vinculo.id },
          data: { deviceApiKeyHash: hashChaveDispositivo(deviceKey) },
        }),
      ).catch(() => undefined);
    }

    // Teto de uso por aparelho/minuto (independente do IP), 429 se passar.
    await this.limiter.limitarUso(motoristaId);

    // Rodada 208 (LGPD): sem ciência da versão vigente da política e dos
    // termos, o app não funciona (428), exceto as rotas liberadas.
    await this.exigirCienciaPrivacidade(context, motorista.id);

    request.motorista = motorista;
    request.deviceUuid = vinculo.deviceUuid;
    request.grupoId = motorista.empresa.grupoId;
    return true;
  }

  private async exigirCienciaPrivacidade(
    context: ExecutionContext,
    motoristaId: string,
  ): Promise<void> {
    if (process.env.EXIGIR_CIENCIA_PRIVACIDADE === 'false') return;
    const liberada = this.reflector?.getAllAndOverride<boolean>(
      PERMITIR_SEM_CIENCIA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (liberada) return;

    const chave = `${motoristaId}:${VERSAO_DOCUMENTOS}`;
    if (MotoristaDeviceGuard.cienciasConfirmadas.has(chave)) return;

    const total = await TenantContext.paraSistema(() =>
      this.prisma.aceitePrivacidade.count({
        where: { motoristaId, versao: VERSAO_DOCUMENTOS },
      }),
    );
    if (total >= Object.values(TipoDocumentoPrivacidade).length) {
      if (MotoristaDeviceGuard.cienciasConfirmadas.size > 20000) {
        MotoristaDeviceGuard.cienciasConfirmadas.clear();
      }
      MotoristaDeviceGuard.cienciasConfirmadas.add(chave);
      return;
    }
    throw new HttpException(
      {
        statusCode: 428,
        code: 'CIENCIA_PRIVACIDADE_PENDENTE',
        message:
          'É necessário ler e dar ciência da Política de Privacidade e dos termos para usar o aplicativo.',
      },
      428,
    );
  }
}
