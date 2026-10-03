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
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
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

    const chaveRecebida = createHash('sha256').update(deviceKey).digest();
    const chaveArmazenada = Buffer.from(vinculo.deviceApiKeyHash, 'hex');
    const chaveOk =
      chaveRecebida.length === chaveArmazenada.length &&
      timingSafeEqual(chaveRecebida, chaveArmazenada);

    if (!uuidOk || !chaveOk) {
      throw new UnauthorizedException('Dispositivo não autorizado');
    }

    request.motorista = motorista;
    request.deviceUuid = vinculo.deviceUuid;
    request.grupoId = motorista.empresa.grupoId;
    return true;
  }
}
