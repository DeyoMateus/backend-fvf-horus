import { jest } from '@test/jest-globals';
import { ForbiddenException } from '@nestjs/common';
import { BancoHorasService } from './banco-horas.service';

describe('BancoHorasService', () => {
  function criarService(overrides: {
    motorista?: any;
    resultadoHolerite?: any;
    ajustes?: any[];
  } = {}) {
    const motorista = overrides.motorista ?? {
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A', regraSindical: { bancoHorasAtivo: true } },
    };
    const prismaMock = {
      motorista: { findUnique: jest.fn().mockResolvedValue(motorista) },
      ajusteBancoHoras: {
        findMany: jest.fn().mockResolvedValue(overrides.ajustes ?? []),
        create: jest.fn(async ({ data }: any) => ({ id: 'ajuste-1', ...data, createdAt: new Date() })),
      },
    } as any;
    const tenantMock = { verificarMotoristaNoGrupo: jest.fn().mockResolvedValue(undefined) } as any;
    const holeriteMock = {
      calcular: jest.fn().mockResolvedValue(
        overrides.resultadoHolerite ?? { totais: { direcaoMin: 600, esperaMin: 0, normalMin: 480, extraMin: 120, noturnoMin: 0 } },
      ),
    } as any;
    const auditMock = { registrar: jest.fn().mockResolvedValue(undefined) } as any;

    const service = new BancoHorasService(prismaMock, tenantMock, holeriteMock, auditMock);
    return { service, prismaMock, tenantMock, holeriteMock, auditMock };
  }

  describe('estaAtivoParaMotorista', () => {
    it('true quando a CCT do motorista tem o toggle ligado', async () => {
      const { service } = criarService();
      await expect(service.estaAtivoParaMotorista('m1')).resolves.toBe(true);
    });

    it('false quando não há CCT vinculada (padrão CLT direto, sem banco)', async () => {
      const { service } = criarService({ motorista: { empresaId: 'empresa-A', empresa: { grupoId: 'grupo-A', regraSindical: null } } });
      await expect(service.estaAtivoParaMotorista('m1')).resolves.toBe(false);
    });
  });

  describe('calcularSaldo', () => {
    it('crédito de hora extra + crédito de correção - débito = saldo', async () => {
      const { service } = criarService({
        ajustes: [
          { data: new Date('2026-09-05'), tipo: 'CORRECAO_CREDITO', minutos: 20 },
          { data: new Date('2026-09-10'), tipo: 'COMPENSACAO', minutos: 60 },
        ],
      });
      const saldo = await service.calcularSaldo('m1', new Date('2026-09-01'), new Date('2026-09-30'), 'grupo-A');
      // 120 (extra) + 20 (correção) - 60 (compensação) = 80
      expect(saldo).toEqual({ ativo: true, creditoExtraMin: 120, creditoCorrecaoMin: 20, debitoMin: 60, saldoMin: 80 });
    });
  });

  describe('registrarAjuste', () => {
    it('confere o tenant antes de criar o ajuste e audita a ação', async () => {
      const { service, tenantMock, prismaMock, auditMock } = criarService();
      await service.registrarAjuste('m1', 'grupo-A', 'usuario-1', {
        tipo: 'PAGAMENTO' as any,
        minutos: 90,
        data: new Date('2026-09-15'),
        observacao: 'pago na folha de setembro',
      });

      expect(tenantMock.verificarMotoristaNoGrupo).toHaveBeenCalledWith('m1', 'grupo-A');
      expect(prismaMock.ajusteBancoHoras.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ motoristaId: 'm1', tipo: 'PAGAMENTO', minutos: 90, registradoPorUsuarioId: 'usuario-1' }),
        }),
      );
      expect(auditMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'BANCO_HORAS_AJUSTE_REGISTRADO' }));
    });

    it('propaga o ForbiddenException se o motorista não pertence ao grupo do solicitante', async () => {
      const { service, tenantMock } = criarService();
      tenantMock.verificarMotoristaNoGrupo.mockRejectedValue(new ForbiddenException());
      await expect(
        service.registrarAjuste('m-outro-grupo', 'grupo-A', 'usuario-1', {
          tipo: 'COMPENSACAO' as any,
          minutos: 30,
          data: new Date('2026-09-15'),
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
