import { jest } from '@test/jest-globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AlertasJornadaService } from './alertas-jornada.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Isolamento entre grupos para AlertasJornadaService. Três caminhos:
 * `listByMotorista` (checagem condicional , só confere tenant quando
 * `grupoIdSolicitante` vem do painel; quando vem do próprio app do
 * motorista, intencionalmente não confere nada, ver comentário no
 * service), `listByGrupo` (sempre filtra pelo grupoId de quem pede,
 * nunca lista todos os grupos) e `marcarVisualizado` (checagem INLINE
 * contra `alerta.motorista.empresa.grupoId`, sem passar pelo
 * TenantService).
 */
describe('AlertasJornadaService , isolamento entre grupos', () => {
  function criarServiceComPrismaMock(
    motorista: { empresaId: string; empresa: { grupoId: string } } | null,
  ) {
    const prismaMock = {
      motorista: { findUnique: jest.fn().mockResolvedValue(motorista) },
      alertaJornada: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      registroJornada: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const tenant = new TenantService(prismaMock);
    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new AlertasJornadaService(prismaMock, auditMock, tenant);
    return { service, prismaMock };
  }

  describe('listByMotorista', () => {
    it('lança ForbiddenException quando chamado do painel (com grupoIdSolicitante) para um motorista de outro grupo', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaId: 'empresa-B',
        empresa: { grupoId: 'grupo-B' },
      });
      await expect(
        service.listByMotorista('motorista-1', 'grupo-A'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite a consulta do painel quando o motorista pertence ao grupo do solicitante', async () => {
      const { service } = criarServiceComPrismaMock({
        empresaId: 'empresa-A',
        empresa: { grupoId: 'grupo-A' },
      });
      await expect(
        service.listByMotorista('motorista-1', 'grupo-A'),
      ).resolves.toEqual([]);
    });

    it('não confere tenant quando chamado sem grupoIdSolicitante (caminho do próprio app do motorista)', async () => {
      const { service, prismaMock } = criarServiceComPrismaMock(null);
      await expect(service.listByMotorista('motorista-1')).resolves.toEqual([]);
      expect(prismaMock.motorista.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('listByGrupo', () => {
    it('filtra sempre pelo grupoId de quem está pedindo, nunca lista todos os grupos', async () => {
      const { service, prismaMock } = criarServiceComPrismaMock(null);
      await service.listByGrupo('grupo-A');
      expect(prismaMock.alertaJornada.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            motorista: { empresa: { grupoId: 'grupo-A' } },
          }),
        }),
      );
    });
  });

  describe('marcarVisualizado , checagem inline (sem TenantService)', () => {
    function criarServiceComAlertaMock(alerta: any) {
      const prismaMock = {
        alertaJornada: {
          findUnique: jest.fn().mockResolvedValue(alerta),
          update: jest
            .fn()
            .mockResolvedValue({ ...alerta, visualizadoEm: new Date() }),
        },
      } as any;
      const auditMock = {
        registrar: jest.fn().mockResolvedValue(undefined),
      } as any;
      const service = new AlertasJornadaService(
        prismaMock,
        auditMock,
        {} as any,
      );
      return { service, prismaMock };
    }

    it('lança NotFoundException quando o alerta não existe', async () => {
      const { service } = criarServiceComAlertaMock(null);
      await expect(
        service.marcarVisualizado('alerta-x', 'usuario-1', 'grupo-A'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando o alerta pertence a um motorista de outro grupo', async () => {
      const { service } = criarServiceComAlertaMock({
        id: 'alerta-1',
        motorista: { empresa: { grupoId: 'grupo-B' } },
      });
      await expect(
        service.marcarVisualizado('alerta-1', 'usuario-1', 'grupo-A'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('marca como visualizado quando o alerta pertence ao grupo do solicitante', async () => {
      const { service } = criarServiceComAlertaMock({
        id: 'alerta-1',
        motorista: { empresa: { grupoId: 'grupo-A' } },
      });
      await expect(
        service.marcarVisualizado('alerta-1', 'usuario-1', 'grupo-A'),
      ).resolves.toBeDefined();
    });
  });
});
