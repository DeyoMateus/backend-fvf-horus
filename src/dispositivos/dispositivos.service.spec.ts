import { jest } from '@test/jest-globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DispositivosService } from './dispositivos.service';
import { TenantService } from '../common/tenant/tenant.service';
import { TenantContext } from '../common/tenant/tenant-context';

/**
 * Isolamento entre grupos para DispositivosService. Cobre dois
 * caminhos distintos: `status()`, que delega para
 * `TenantService.verificarMotoristaNoGrupo` via `conferirTenant`, e
 * `aprovarTroca()`/`rejeitarTroca()`, que fazem a checagem INLINE
 * contra `solicitacao.motorista.empresa.grupoId` (não passam pelo
 * TenantService) , um gestor do grupo A não pode aprovar/rejeitar uma
 * solicitação de troca de aparelho de um motorista do grupo B.
 */
describe('DispositivosService , isolamento entre grupos', () => {
  function criarServiceComPrismaMock(
    motorista: { empresaId: string; empresa: { grupoId: string } } | null,
  ) {
    const prismaMock = {
      motorista: { findUnique: jest.fn().mockResolvedValue(motorista) },
      dispositivoVinculado: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;

    const tenant = new TenantService(prismaMock);
    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new DispositivosService(prismaMock, auditMock, tenant);
    return { service, prismaMock };
  }

  describe('status', () => {
    it('lança NotFoundException quando o motorista não existe', async () => {
      const { service } = criarServiceComPrismaMock(null);
      await expect(service.status('motorista-x', 'grupo-A')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança ForbiddenException quando o motorista pertence a uma empresa de outro grupo', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaId: 'empresa-B',
        empresa: { grupoId: 'grupo-B' },
      });
      await expect(service.status('motorista-1', 'grupo-A')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('permite a consulta quando o motorista pertence ao grupo do solicitante', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaId: 'empresa-A',
        empresa: { grupoId: 'grupo-A' },
      });
      await expect(service.status('motorista-1', 'grupo-A')).resolves.toEqual({
        vinculado: false,
      });
    });
  });

  describe('aprovarTroca / rejeitarTroca , checagem inline (sem TenantService)', () => {
    function criarServiceComSolicitacaoMock(solicitacao: any) {
      const solicitacaoUpdate = {
        findUnique: jest.fn().mockResolvedValue(solicitacao),
        update: jest
          .fn()
          .mockResolvedValue({ ...solicitacao, status: 'APROVADA' }),
      };
      const dispositivoVinculado = {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest
          .fn()
          .mockResolvedValue({
            deviceUuid: 'device-novo',
            vinculadoEm: new Date(),
          }),
      };
      const prismaMock = {
        solicitacaoTrocaDispositivo: solicitacaoUpdate,
        dispositivoVinculado,
        // Row-Level Security (Rodada 23): `aprovarTroca` monta o array de
        // `$transaction` com `this.prisma.cru.*` (delegados SEM a
        // interceptação de RLS) + um SET LOCAL manual como 1º item , o
        // mock precisa dos mesmos três itens no retorno.
        cru: {
          solicitacaoTrocaDispositivo: solicitacaoUpdate,
          dispositivoVinculado,
        },
        $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
        $transaction: jest
          .fn()
          .mockResolvedValue([
            undefined,
            {},
            { deviceUuid: 'device-novo', vinculadoEm: new Date() },
          ]),
      } as any;
      const auditMock = {
        registrar: jest.fn().mockResolvedValue(undefined),
      } as any;
      const service = new DispositivosService(prismaMock, auditMock, {} as any);
      return { service, prismaMock };
    }

    it('aprovarTroca lança NotFoundException quando a solicitação não existe', async () => {
      const { service } = criarServiceComSolicitacaoMock(null);
      await expect(
        service.aprovarTroca('sol-x', 'usuario-1', 'grupo-A'),
      ).rejects.toThrow(NotFoundException);
    });

    it('aprovarTroca lança ForbiddenException quando a solicitação é de um motorista de outro grupo', async () => {
      const { service } = criarServiceComSolicitacaoMock({
        id: 'sol-1',
        status: 'PENDENTE',
        motoristaId: 'motorista-1',
        deviceUuidSolicitado: 'device-novo',
        motorista: { empresa: { grupoId: 'grupo-B' } },
      });
      await expect(
        service.aprovarTroca('sol-1', 'usuario-1', 'grupo-A'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('aprovarTroca funciona quando a solicitação é do grupo do solicitante', async () => {
      const { service } = criarServiceComSolicitacaoMock({
        id: 'sol-1',
        status: 'PENDENTE',
        motoristaId: 'motorista-1',
        deviceUuidSolicitado: 'device-novo',
        motorista: { empresa: { grupoId: 'grupo-A' } },
      });
      // TenantContext (Rodada 23): em produção o TenantContextInterceptor
      // já estabelece isso antes de qualquer controller/service rodar;
      // aqui, fora de uma requisição HTTP de verdade, o teste estabelece
      // o mesmo contexto manualmente.
      await TenantContext.paraGrupo('grupo-A', async () => {
        await expect(
          service.aprovarTroca('sol-1', 'usuario-1', 'grupo-A'),
        ).resolves.toMatchObject({
          motoristaId: 'motorista-1',
        });
      });
    });

    it('rejeitarTroca lança ForbiddenException quando a solicitação é de um motorista de outro grupo', async () => {
      const { service } = criarServiceComSolicitacaoMock({
        id: 'sol-1',
        status: 'PENDENTE',
        motoristaId: 'motorista-1',
        motorista: { empresa: { grupoId: 'grupo-B' } },
      });
      await expect(
        service.rejeitarTroca('sol-1', 'usuario-1', 'motivo x', 'grupo-A'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
