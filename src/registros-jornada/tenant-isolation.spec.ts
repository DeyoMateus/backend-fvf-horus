import { jest } from '@test/jest-globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RegistrosJornadaService } from './registros-jornada.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Regressão pro achado de segurança da Rodada 2 (empresaId tem que vir
 * SEMPRE do JWT, nunca de @Param()/@Query()) , atualizado quando o
 * modelo passou a suportar múltiplos CNPJs por login (grupoId no
 * token, não mais empresaId): um usuário do grupo A não pode ler dados
 * de um motorista de uma empresa do grupo B trocando o id na URL.
 * Testa isso via `consolidarViagens`, que é pública e passa por
 * `conferirTenant` (que agora delega pra TenantService.verificarMotoristaNoGrupo)
 * antes de qualquer outra coisa.
 */
describe('RegistrosJornadaService , isolamento entre grupos', () => {
  function criarServiceComPrismaMock(
    motorista: { empresaId: string; empresa: { grupoId: string } } | null,
  ) {
    const prismaMock = {
      motorista: { findUnique: jest.fn().mockResolvedValue(motorista) },
      registroJornada: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;

    const tenant = new TenantService(prismaMock);

    // Só `prisma`/`tenant` são usados por conferirTenant/consolidarViagens;
    // os demais providers do construtor não entram nesse caminho de código.
    const service = new RegistrosJornadaService(
      prismaMock,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      tenant,
    );
    return { service, prismaMock };
  }

  it('lança ForbiddenException quando o motorista pertence a uma empresa de outro grupo', async () => {
    const { service } = criarServiceComPrismaMock({
      empresaId: 'empresa-B',
      empresa: { grupoId: 'grupo-B' },
    });
    await expect(
      service.consolidarViagens('motorista-1', 'grupo-A'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lança NotFoundException quando o motorista não existe', async () => {
    const { service } = criarServiceComPrismaMock(null);
    await expect(
      service.consolidarViagens('motorista-inexistente', 'grupo-A'),
    ).rejects.toThrow(NotFoundException);
  });

  it('permite a consulta quando o motorista pertence a uma empresa do grupo do solicitante', async () => {
    const { service } = criarServiceComPrismaMock({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    const resultado = await service.consolidarViagens('motorista-1', 'grupo-A');
    expect(resultado).toEqual([]);
  });
});
