import { jest } from '@test/jest-globals';
import { DashboardService } from './dashboard.service';

/**
 * Regressão do painel da operação: os cards de "estado atual" (Em
 * direção, Em descanso etc.) e o drill-down por trás de cada card
 * (`detalheCard`) precisam usar o mesmo critério de "evento mais
 * recente" que `resumo()` usa , ou seja, ordenado por `timestampEvento`
 * (o horário real do evento), não por `sequencial` (ordem de chegada
 * ao servidor). Ver o mesmo bug já corrigido em
 * registros-jornada.service.ts / ordenacao-timestamp.spec.ts , aqui é
 * a mesma correção aplicada às consultas raw SQL do dashboard.
 */
describe('DashboardService', () => {
  function criarServiceComPrismaMock(overrides: Record<string, unknown> = {}) {
    const prismaMock = {
      motorista: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      alertaJornada: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      ...overrides,
    } as any;
    const service = new DashboardService(prismaMock);
    return { service, prismaMock };
  }

  describe('detalheCard , consultas raw SQL usam timestampEvento, não sequencial', () => {
    it('todas as consultas $queryRaw de estado atual ordenam por timestampEvento (sequencial só como desempate)', async () => {
      const { service, prismaMock } = criarServiceComPrismaMock();
      await service.detalheCard('grupo-A', 'em-direcao');
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      const sqlChamado = (
        prismaMock.$queryRaw.mock.calls[0][0] as { strings: string[] }
      ).strings.join('');
      expect(sqlChamado).toContain(
        'ORDER BY r."motoristaId", r."timestampEvento" DESC, r.sequencial DESC',
      );
    });
  });

  describe('detalheCard , cards de motoristas', () => {
    it('"ativos" lista todos os motoristas ativos do grupo, ordenados por nome', async () => {
      const { service, prismaMock } = criarServiceComPrismaMock({
        motorista: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'm2', nome: 'Bruno' },
            { id: 'm1', nome: 'Ana' },
          ]),
        },
      });
      const resultado = await service.detalheCard('grupo-A', 'ativos');
      expect(prismaMock.motorista.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ empresa: { grupoId: 'grupo-A' } }),
        }),
      );
      expect(resultado.tipo).toBe('motoristas');
      expect(resultado.itens).toEqual([
        { motoristaId: 'm2', nome: 'Bruno', detalhe: null },
        { motoristaId: 'm1', nome: 'Ana', detalhe: null },
      ]);
    });

    it('"em-direcao" filtra pelo tipoEvento mais recente = INICIO_DIRECAO', async () => {
      const { service } = criarServiceComPrismaMock({
        $queryRaw: jest.fn().mockResolvedValue([
          {
            motoristaId: 'm1',
            nome: 'Ana',
            tipoEvento: 'INICIO_DIRECAO',
            timestampEvento: new Date('2026-09-21T08:00:00Z'),
          },
          {
            motoristaId: 'm2',
            nome: 'Bruno',
            tipoEvento: 'INICIO_DESCANSO',
            timestampEvento: new Date('2026-09-21T08:00:00Z'),
          },
        ]),
      });
      const resultado = await service.detalheCard('grupo-A', 'em-direcao');
      expect(resultado.tipo).toBe('motoristas');
      expect(resultado.itens.map((i) => i.motoristaId)).toEqual(['m1']);
    });

    it('"sem-nenhum-registro" retorna os motoristas ativos que não aparecem no estado atual', async () => {
      const { service } = criarServiceComPrismaMock({
        motorista: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'm1', nome: 'Ana' },
            { id: 'm2', nome: 'Bruno' },
          ]),
        },
        $queryRaw: jest
          .fn()
          .mockResolvedValue([
            {
              motoristaId: 'm1',
              nome: 'Ana',
              tipoEvento: 'INICIO_DIRECAO',
              timestampEvento: new Date(),
            },
          ]),
      });
      const resultado = await service.detalheCard(
        'grupo-A',
        'sem-nenhum-registro',
      );
      expect(resultado.itens).toEqual([
        { motoristaId: 'm2', nome: 'Bruno', detalhe: null },
      ]);
    });
  });

  describe('detalheCard , cards de alertas', () => {
    const alertaMock = {
      id: 'alerta-1',
      tipo: 'ODOMETRO_REGRESSIVO',
      severidade: 'CRITICO',
      createdAt: new Date('2026-09-21T08:00:00Z'),
      motorista: { id: 'm1', nome: 'Ana' },
    };

    it('"alertas-criticos" filtra por severidade CRITICO e visualizadoEm null', async () => {
      const { service, prismaMock } = criarServiceComPrismaMock({
        alertaJornada: { findMany: jest.fn().mockResolvedValue([alertaMock]) },
      });
      const resultado = await service.detalheCard(
        'grupo-A',
        'alertas-criticos',
      );
      expect(prismaMock.alertaJornada.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visualizadoEm: null,
            severidade: 'CRITICO',
          }),
        }),
      );
      expect(resultado.tipo).toBe('alertas');
      expect(resultado.itens).toEqual([
        {
          alertaId: 'alerta-1',
          motoristaId: 'm1',
          nome: 'Ana',
          tipo: 'ODOMETRO_REGRESSIVO',
          severidade: 'CRITICO',
          createdAt: alertaMock.createdAt,
        },
      ]);
    });

    it('card desconhecido não quebra , volta lista vazia de motoristas', async () => {
      const { service } = criarServiceComPrismaMock();
      const resultado = await service.detalheCard('grupo-A', '' as any);
      expect(resultado).toEqual({ tipo: 'motoristas', itens: [] });
    });
  });
});
