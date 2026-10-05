import { jest } from '@test/jest-globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TratamentosPontoService } from './tratamentos-ponto.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Isolamento entre grupos para TratamentosPontoService: um RH/gestor do
 * grupo A não pode lançar um tratamento de ponto para, nem ler os
 * tratamentos de, um motorista de uma empresa que pertence ao grupo B.
 * Cobre `create` e `listByMotorista`, que delegam a checagem para
 * `TenantService.verificarMotoristaNoGrupo` antes de qualquer leitura
 * ou escrita.
 */
describe('TratamentosPontoService , isolamento entre grupos', () => {
  function criarServiceComPrismaMock(
    motorista: { empresaId: string; empresa: { grupoId: string } } | null,
  ) {
    const motoristaCompleto = motorista && {
      id: 'motorista-1',
      nome: 'Motorista Teste',
      status: 'ATIVO',
      excluidoEm: null,
      hashGenesis: 'genesis-x',
      ...motorista,
    };
    const usuarioCompleto = {
      id: 'usuario-1',
      nome: 'Fulano RH',
      email: 'fulano@empresa.com',
    };
    const prismaMock = {
      motorista: { findUnique: jest.fn().mockResolvedValue(motoristaCompleto) },
      usuarioEmpresa: {
        findUnique: jest.fn().mockResolvedValue(usuarioCompleto),
      },
      registroJornada: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        // Rodada 139: validarEncaixeNaJornada monta a linha do tempo.
        findMany: jest.fn().mockResolvedValue([]),
      },
      tratamentoPonto: {
        create: jest.fn().mockResolvedValue({ id: 'trat-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const tenant = new TenantService(prismaMock);
    const hashChainMock = {
      sha256: jest.fn().mockReturnValue('hash-x'),
    } as any;
    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;
    const storageMock = {
      configurado: jest.fn().mockReturnValue(false),
    } as any;
    const pushMock = {
      notificarMotorista: jest.fn().mockResolvedValue(undefined),
    } as any;
    // Rodada 93 , reavaliação pós-ajuste (ver criarRegistroAncorado),
    // best-effort e disparada sem await: um mock resolvido basta, não
    // há nada pra este teste afirmar sobre ela.
    const registrosJornadaMock = {
      verificarEAgendarProximoMotorista: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new TratamentosPontoService(
      prismaMock,
      hashChainMock,
      auditMock,
      tenant,
      storageMock,
      pushMock,
      registrosJornadaMock,
    );
    return { service, prismaMock };
  }

  const dto = {
    tipoEvento: 'INICIO_JORNADA',
    timestampEvento: new Date().toISOString(),
    motivo: 'correção manual',
  } as any;

  describe('create', () => {
    it('lança NotFoundException quando o motorista não existe', async () => {
      const { service } = criarServiceComPrismaMock(null);
      await expect(
        service.create('motorista-x', dto, 'usuario-1', 'grupo-A'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando o motorista pertence a uma empresa de outro grupo', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaId: 'empresa-B',
        empresa: { grupoId: 'grupo-B' },
      });
      await expect(
        service.create('motorista-1', dto, 'usuario-1', 'grupo-A'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cria o tratamento quando o motorista pertence ao grupo do solicitante', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaId: 'empresa-A',
        empresa: { grupoId: 'grupo-A' },
      });
      await expect(
        service.create('motorista-1', dto, 'usuario-1', 'grupo-A'),
      ).resolves.toMatchObject({
        id: 'trat-1',
      });
    });
  });

  describe('listByMotorista', () => {
    it('lança ForbiddenException quando o motorista pertence a uma empresa de outro grupo', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaId: 'empresa-B',
        empresa: { grupoId: 'grupo-B' },
      });
      await expect(
        service.listByMotorista('motorista-1', 'grupo-A'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite a consulta quando o motorista pertence ao grupo do solicitante', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaId: 'empresa-A',
        empresa: { grupoId: 'grupo-A' },
      });
      await expect(
        service.listByMotorista('motorista-1', 'grupo-A'),
      ).resolves.toEqual([]);
    });
  });
});
