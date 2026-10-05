import { jest } from '@test/jest-globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { VeiculosService } from './veiculos.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Regras que este teste protege:
 *  1. Isolamento entre grupos (mesmo padrão de TratamentosPontoService).
 *  2. O PRIMEIRO cadastro de placa (motorista novo, ou legado sem
 *     VeiculoVinculado ainda) nunca vira o alerta 'VEICULO_TROCADO' ,
 *     só uma troca de verdade (placa diferente de uma já existente) vira.
 *  3. A placa é normalizada (maiúsculas, sem espaço) antes de comparar
 *     e de gravar , "abc 1234" e "ABC1234" são a mesma placa.
 */
describe('VeiculosService', () => {
  function criarServiceComMocks(opts: {
    motorista?: { empresaId: string; empresa: { grupoId: string } } | null;
    veiculoAtual?: { placa: string } | null;
  }) {
    const motorista =
      opts.motorista === undefined
        ? { empresaId: 'empresa-A', empresa: { grupoId: 'grupo-A' } }
        : opts.motorista;
    const motoristaCompleto = motorista && { id: 'motorista-1', ...motorista };

    const prismaMock = {
      motorista: { findUnique: jest.fn().mockResolvedValue(motoristaCompleto) },
      veiculoVinculado: {
        findUnique: jest.fn().mockResolvedValue(opts.veiculoAtual ?? null),
        // Rodada 105: conflito de placa com outro motorista ativo (nenhum nos testes).
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest
          .fn()
          .mockImplementation(({ update, create }: any) =>
            Promise.resolve({
              id: 'veiculo-1',
              motoristaId: 'motorista-1',
              ...(opts.veiculoAtual ? update : create),
            }),
          ),
      },
    } as any;

    const tenant = new TenantService(prismaMock);
    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new VeiculosService(prismaMock, auditMock, tenant);
    return { service, prismaMock, auditMock };
  }

  it('lança NotFoundException quando o motorista não existe', async () => {
    const { service } = criarServiceComMocks({ motorista: null });
    await expect(
      service.atualizar(
        'motorista-x',
        { placa: 'ABC1234' },
        { tipo: ActorType.USUARIO_EMPRESA, id: 'usuario-1' },
        'grupo-A',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança ForbiddenException quando o motorista pertence a uma empresa de outro grupo', async () => {
    const { service } = criarServiceComMocks({
      motorista: { empresaId: 'empresa-B', empresa: { grupoId: 'grupo-B' } },
    });
    await expect(
      service.atualizar(
        'motorista-1',
        { placa: 'ABC1234' },
        { tipo: ActorType.USUARIO_EMPRESA, id: 'usuario-1' },
        'grupo-A',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('primeiro cadastro de placa grava VEICULO_VINCULADO, não VEICULO_TROCADO', async () => {
    const { service, auditMock } = criarServiceComMocks({ veiculoAtual: null });
    await service.atualizar(
      'motorista-1',
      { placa: 'abc 1234' },
      { tipo: ActorType.MOTORISTA, id: 'motorista-1' },
    );

    expect(auditMock.registrar).toHaveBeenCalledTimes(1);
    const chamada = (auditMock.registrar as jest.Mock).mock.calls[0][0] as any;
    expect(chamada.acao).toBe('VEICULO_VINCULADO');
    expect(chamada.detalhes.placaNova).toBe('ABC1234');
  });

  it('reenviar a MESMA placa (só trocando idRastreador, por exemplo) grava VEICULO_ATUALIZADO, não VEICULO_TROCADO', async () => {
    const { service, auditMock } = criarServiceComMocks({
      veiculoAtual: { placa: 'ABC1234' },
    });
    await service.atualizar(
      'motorista-1',
      { placa: 'ABC1234', idRastreador: 'rastreador-x' },
      { tipo: ActorType.MOTORISTA, id: 'motorista-1' },
    );

    const chamada = (auditMock.registrar as jest.Mock).mock.calls[0][0] as any;
    expect(chamada.acao).toBe('VEICULO_ATUALIZADO');
  });

  it('trocar de fato a placa grava VEICULO_TROCADO , o alerta pro gestor', async () => {
    const { service, auditMock } = criarServiceComMocks({
      veiculoAtual: { placa: 'ABC1234' },
    });
    await service.atualizar(
      'motorista-1',
      { placa: 'XYZ9999' },
      { tipo: ActorType.MOTORISTA, id: 'motorista-1' },
    );

    const chamada = (auditMock.registrar as jest.Mock).mock.calls[0][0] as any;
    expect(chamada.acao).toBe('VEICULO_TROCADO');
    expect(chamada.detalhes.placaAnterior).toBe('ABC1234');
    expect(chamada.detalhes.placaNova).toBe('XYZ9999');
  });

  it('normaliza espaço/minúsculas antes de comparar , "abc1234" para "ABC1234" NÃO conta como troca', async () => {
    const { service, auditMock } = criarServiceComMocks({
      veiculoAtual: { placa: 'ABC1234' },
    });
    await service.atualizar(
      'motorista-1',
      { placa: 'abc1234' },
      { tipo: ActorType.MOTORISTA, id: 'motorista-1' },
    );

    const chamada = (auditMock.registrar as jest.Mock).mock.calls[0][0] as any;
    expect(chamada.acao).toBe('VEICULO_ATUALIZADO');
  });
});
