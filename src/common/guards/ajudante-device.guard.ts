import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
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
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
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
      throw new UnauthorizedException('Dispositivo não autorizado');
    }

    const vinculo = ajudante.dispositivoVinculado;

    const uuidRecebido = createHash('sha256').update(deviceUuid).digest();
    const uuidVinculado = createHash('sha256')
      .update(vinculo.deviceUuid)
      .digest();
    const uuidOk = timingSafeEqual(uuidRecebido, uuidVinculado);

    const chaveRecebida = createHash('sha256').update(deviceKey).digest();
    const chaveArmazenada = Buffer.from(vinculo.deviceApiKeyHash, 'hex');
    const chaveOk =
      chaveRecebida.length === chaveArmazenada.length &&
      timingSafeEqual(chaveRecebida, chaveArmazenada);

    if (!uuidOk || !chaveOk) {
      throw new UnauthorizedException('Dispositivo não autorizado');
    }

    request.ajudante = ajudante;
    request.deviceUuid = vinculo.deviceUuid;
    request.grupoId = ajudante.empresa.grupoId;
    return true;
  }
}
