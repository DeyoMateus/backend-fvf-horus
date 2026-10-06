import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import {
  conferirChaveDispositivo,
  hashChaveDispositivo,
} from '../crypto/device-key-hash.util';
import { DeviceAuthLimiterService } from '../throttler/device-auth-limiter.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant-context';

/**
 * Autenticação + device binding do app do ajudante (Rodada 66) , mesmo
 * mecanismo do MotoristaDeviceGuard, cadastro/tabelas separadas:
 *   X-Ajudante-Id  → quem é
 *   X-Device-Key   → segredo do vínculo
 *   X-Device-Uuid  → identificador do aparelho físico
 */
@Injectable()
export class AjudanteDeviceGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: DeviceAuthLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip: string = request.ip ?? 'desconhecido';
    // Rodada 165: IP já bloqueado por falhas anteriores nem chega a autenticar (429).
    await this.limiter.exigirNaoBloqueado(ip);
    const ajudanteId = request.headers['x-ajudante-id'];
    const deviceKey = request.headers['x-device-key'];
    const deviceUuid = request.headers['x-device-uuid'];

    if (
      !ajudanteId ||
      !deviceKey ||
      !deviceUuid ||
      typeof ajudanteId !== 'string' ||
      typeof deviceKey !== 'string' ||
      typeof deviceUuid !== 'string'
    ) {
      await this.limiter.registrarFalha(ip, 'sem-credenciais');
      throw new UnauthorizedException('Credenciais de dispositivo ausentes');
    }

    const ajudante = await TenantContext.paraSistema(() =>
      this.prisma.ajudante.findUnique({
        where: { id: ajudanteId },
        include: {
          dispositivoVinculado: true,
          empresa: { select: { grupoId: true } },
        },
      }),
    );

    if (
      !ajudante ||
      ajudante.status !== 'ATIVO' ||
      !ajudante.dispositivoVinculado
    ) {
      await this.limiter.registrarFalha(ip, ajudanteId);
      throw new UnauthorizedException('Dispositivo não autorizado');
    }

    const vinculo = ajudante.dispositivoVinculado;

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
      await this.limiter.registrarFalha(ip, ajudanteId);
      throw new UnauthorizedException('Dispositivo não autorizado');
    }

    // Rodada 165: hash antigo (SHA-256 simples) vira HMAC no primeiro acesso
    // válido. Falha aqui nunca derruba a requisição (tenta de novo no próximo).
    if (precisaMigrar) {
      void TenantContext.paraSistema(() =>
        this.prisma.dispositivoVinculadoAjudante.update({
          where: { id: vinculo.id },
          data: { deviceApiKeyHash: hashChaveDispositivo(deviceKey) },
        }),
      ).catch(() => undefined);
    }

    // Teto de uso por aparelho/minuto (independente do IP), 429 se passar.
    await this.limiter.limitarUso(ajudanteId);

    request.ajudante = ajudante;
    request.deviceUuid = vinculo.deviceUuid;
    request.grupoId = ajudante.empresa.grupoId;
    return true;
  }
}
