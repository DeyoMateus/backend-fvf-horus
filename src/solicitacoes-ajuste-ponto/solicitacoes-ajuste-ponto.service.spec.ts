import { jest } from '@test/jest-globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SolicitacoesAjustePontoService } from './solicitacoes-ajuste-ponto.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Cobre o núcleo do fluxo "motorista pede, RH decide": isolamento entre
 * grupos, rejeição exigindo motivo, aprovação gerando o TratamentoPonto
 * oficial (via TratamentosPontoService.criarRegistroAncorado) e , o mais
 * importante , que decidir UMA solicitação nunca mexe em outra.
 */
describe('SolicitacoesAjustePontoService', () => {
  function criarService(
    motorista: { empresaId: string; empresa: { grupoId: string } } | null,
  ) {
    const solicitacaoBase = {
      id: 'sol-1',
      motoristaId: 'motorista-1',
      tipoEvento: 'FIM_DIRECAO',
      timestampEvento: new Date('2026-09-20T12:00:00Z'),
      justificativa: 'esqueci de bater',
      registroReferenciaId: null,
      status: 'PENDENTE',
    };

    const prismaMock = {
      // Rodada 123: motorista precisa estar ATIVO e não excluído (escrita).
      motorista: {
        findUnique: jest.fn().mockResolvedValue(
          motorista && {
            nome: 'Motorista Teste',
            status: 'ATIVO',
            excluidoEm: null,
            ...motorista,
          },
        ),
      },
      registroJornada: { findUnique: jest.fn().mockResolvedValue(null) },
      solicitacaoAjustePonto: {
        findUnique: jest.fn().mockResolvedValue(solicitacaoBase),
        update: jest
          .fn()
          .mockImplementation((args: any) =>
            Promise.resolve({ ...solicitacaoBase, ...args.data }),
          ),
      },
    } as any;

    const tenant = new TenantService(prismaMock);
    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;
    const storageMock = {
      configurado: jest.fn().mockReturnValue(false),
    } as any;
    const pushMock = {
      notificarMotorista: jest.fn().mockResolvedValue(undefined),
    } as any;
    const tratamentosPontoMock = {
      criarRegistroAncorado: jest.fn().mockResolvedValue({ id: 'trat-1' }),
    } as any;

    const service = new SolicitacoesAjustePontoService(
      prismaMock,
      auditMock,
      tenant,
      storageMock,
      pushMock,
      tratamentosPontoMock,
    );
    return { service, prismaMock, tratamentosPontoMock, pushMock };
  }

  it('lança ForbiddenException ao aprovar solicitação de motorista de outro grupo', async () => {
    const { service } = criarService({
      empresaId: 'empresa-B',
      empresa: { grupoId: 'grupo-B' },
    });
    await expect(
      service.aprovar('sol-1', undefined, 'usuario-1', 'grupo-A'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lança BadRequestException ao rejeitar sem motivo', async () => {
    const { service } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    await expect(
      service.rejeitar('sol-1', '', 'usuario-1', 'grupo-A'),
    ).rejects.toThrow(BadRequestException);
  });

  it('ao aprovar, cria o TratamentoPonto ancorado e notifica o motorista', async () => {
    const { service, prismaMock, tratamentosPontoMock, pushMock } =
      criarService({
        empresaId: 'empresa-A',
        empresa: { grupoId: 'grupo-A' },
      });

    const resultado = await service.aprovar(
      'sol-1',
      'ok, confirmado com o rastreador',
      'usuario-1',
      'grupo-A',
    );

    expect(tratamentosPontoMock.criarRegistroAncorado).toHaveBeenCalledTimes(1);
    expect(prismaMock.solicitacaoAjustePonto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sol-1' },
        data: expect.objectContaining({
          status: 'APROVADA',
          tratamentoPontoId: 'trat-1',
        }),
      }),
    );
    expect(pushMock.notificarMotorista).toHaveBeenCalledTimes(1);
    expect(resultado.status).toBe('APROVADA');
  });

  it('ao rejeitar, NÃO chama criarRegistroAncorado e só atualiza a própria solicitação', async () => {
    const { service, prismaMock, tratamentosPontoMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });

    await service.rejeitar(
      'sol-1',
      'sem evidência suficiente',
      'usuario-1',
      'grupo-A',
    );

    expect(tratamentosPontoMock.criarRegistroAncorado).not.toHaveBeenCalled();
    expect(prismaMock.solicitacaoAjustePonto.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.solicitacaoAjustePonto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sol-1' },
        data: expect.objectContaining({ status: 'REJEITADA' }),
      }),
    );
  });

  it('lança BadRequestException ao tentar decidir uma solicitação que já foi decidida', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    prismaMock.solicitacaoAjustePonto.findUnique.mockResolvedValue({
      id: 'sol-1',
      motoristaId: 'motorista-1',
      status: 'APROVADA',
    });
    await expect(
      service.aprovar('sol-1', undefined, 'usuario-1', 'grupo-A'),
    ).rejects.toThrow(BadRequestException);
  });
});
