import { jest } from '@test/jest-globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FeriadosService } from './feriados.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Isolamento entre grupos e regras básicas do cadastro de feriados
 * (Rodada 29) , mesmo padrão de instanciação direta com mocks
 * posicionais já usado em regras-sindicais/tratamentos-ponto.
 */
describe('FeriadosService', () => {
  function criarService(empresaDoDto?: { grupoId: string } | null) {
    const prismaMock = {
      feriado: {
        create: jest.fn(async (args: any) => ({
          id: 'feriado-1',
          ...args.data,
        })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(async (args: any) => ({
          id: args.where.id,
          ...args.data,
        })),
      },
      empresa: {
        findUnique: jest.fn().mockResolvedValue(empresaDoDto ?? null),
      },
    } as any;
    const tenant = new TenantService(prismaMock);
    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new FeriadosService(prismaMock, auditMock, tenant);
    return { service, prismaMock };
  }

  describe('create', () => {
    it('cria um feriado sem empresaId (vale para todo o grupo), sem checar empresa', async () => {
      const { service, prismaMock } = criarService();
      const feriado = await service.create(
        { data: '2026-11-02', descricao: 'Finados' },
        'grupo-A',
        'usuario-1',
      );
      expect(feriado).toMatchObject({
        descricao: 'Finados',
        grupoId: 'grupo-A',
        pagoComoDomingo: true,
      });
      expect(prismaMock.empresa.findUnique).not.toHaveBeenCalled();
    });

    it('lança ForbiddenException (via TenantService) quando empresaId informado não pertence ao grupo', async () => {
      const { service } = criarService({ grupoId: 'grupo-B' });
      await expect(
        service.create(
          { data: '2026-11-02', descricao: 'Finados', empresaId: 'empresa-1' },
          'grupo-A',
          'usuario-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cria com empresaId quando ele pertence ao grupo do solicitante', async () => {
      const { service } = criarService({ grupoId: 'grupo-A' });
      const feriado = await service.create(
        {
          data: '2026-11-02',
          descricao: 'Feriado municipal',
          empresaId: 'empresa-1',
          pagoComoDomingo: false,
        },
        'grupo-A',
        'usuario-1',
      );
      expect(feriado).toMatchObject({
        empresaId: 'empresa-1',
        pagoComoDomingo: false,
      });
    });
  });

  describe('findById / desativar', () => {
    it('lança ForbiddenException ao consultar um feriado de outro grupo', async () => {
      const { service, prismaMock } = criarService();
      prismaMock.feriado.findUnique.mockResolvedValue({
        id: 'f1',
        grupoId: 'grupo-B',
      });
      await expect(service.findById('f1', 'grupo-A')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lança NotFoundException ao desativar um feriado inexistente', async () => {
      const { service, prismaMock } = criarService();
      prismaMock.feriado.findUnique.mockResolvedValue(null);
      await expect(
        service.desativar('f-x', 'grupo-A', 'usuario-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('desativa (nunca apaga de verdade) um feriado do próprio grupo', async () => {
      const { service, prismaMock } = criarService();
      prismaMock.feriado.findUnique.mockResolvedValue({
        id: 'f1',
        grupoId: 'grupo-A',
      });
      const resultado = await service.desativar('f1', 'grupo-A', 'usuario-1');
      expect(resultado).toMatchObject({ ativo: false });
      expect(prismaMock.feriado.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { ativo: false },
      });
    });
  });

  describe('listarParaRelatorio', () => {
    it('consulta feriados ativos do grupo, globais + restritos ao CNPJ, dentro do período', async () => {
      const { service, prismaMock } = criarService();
      const inicio = new Date('2026-09-01');
      const fim = new Date('2026-09-30');
      await service.listarParaRelatorio('grupo-A', 'empresa-1', inicio, fim);
      expect(prismaMock.feriado.findMany).toHaveBeenCalledWith({
        where: {
          grupoId: 'grupo-A',
          ativo: true,
          data: { gte: inicio, lte: fim },
          OR: [{ empresaId: null }, { empresaId: 'empresa-1' }],
        },
        orderBy: { data: 'asc' },
      });
    });
  });
});
