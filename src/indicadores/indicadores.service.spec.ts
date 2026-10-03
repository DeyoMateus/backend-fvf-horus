import { jest } from '@test/jest-globals';
import { IndicadoresService } from './indicadores.service';

/**
 * Regressão principal desta rodada: os totais/percentuais/ranking do
 * painel "Indicadores" precisam bater com o que o HoleriteService
 * calcula por motorista (nunca duplicar a lógica de
 * direção/espera/normal/extra/noturno) e NUNCA expor nenhum campo de
 * valor em R$ , restrição explícita do usuário.
 */
describe('IndicadoresService', () => {
  function criarServiceComMocks(
    overrides: {
      motoristas?: Array<{ id: string; nome: string }>;
      resultadosHolerite?: Record<string, unknown>;
      alertas?: Array<{
        motoristaId: string;
        severidade: string;
        tipo: string;
        createdAt: Date;
      }>;
    } = {},
  ) {
    const motoristas = overrides.motoristas ?? [
      { id: 'm1', nome: 'Ana' },
      { id: 'm2', nome: 'Bruno' },
    ];
    const resultadosPorMotorista: Record<string, any> =
      overrides.resultadosHolerite ?? {
        m1: {
          totais: {
            direcaoMin: 600,
            esperaMin: 100,
            normalMin: 480,
            extraMin: 120,
            noturnoMin: 60,
          },
          dias: [
            {
              dia: '2026-09-01',
              direcaoMin: 600,
              esperaMin: 100,
              normalMin: 480,
              extraMin: 120,
              noturnoMin: 60,
            },
          ],
        },
        m2: {
          totais: {
            direcaoMin: 400,
            esperaMin: 50,
            normalMin: 400,
            extraMin: 0,
            noturnoMin: 0,
          },
          dias: [
            {
              dia: '2026-09-01',
              direcaoMin: 400,
              esperaMin: 50,
              normalMin: 400,
              extraMin: 0,
              noturnoMin: 0,
            },
          ],
        },
      };
    const alertas = overrides.alertas ?? [
      {
        motoristaId: 'm1',
        severidade: 'CRITICO',
        tipo: 'VELOCIDADE_IMPOSSIVEL_ENTRE_REGISTROS',
        createdAt: new Date('2026-09-01T10:00:00Z'),
      },
      {
        motoristaId: 'm2',
        severidade: 'ATENCAO',
        tipo: 'ESPERA_PROXIMA_LIMITE',
        createdAt: new Date('2026-09-01T11:00:00Z'),
      },
    ];

    const prismaMock = {
      motorista: { findMany: jest.fn().mockResolvedValue(motoristas) },
      alertaJornada: { findMany: jest.fn().mockResolvedValue(alertas) },
    } as any;
    const tenantMock = {
      verificarMotoristaNoGrupo: jest.fn().mockResolvedValue(undefined),
    } as any;
    const holeriteMock = {
      calcular: jest.fn(
        async (motoristaId: string) => resultadosPorMotorista[motoristaId],
      ),
    } as any;
    // Por padrão nenhum motorista tem banco de horas ligado , os testes
    // de banco de horas (mais abaixo) sobrescrevem isso especificamente.
    const bancoHorasMock = {
      estaAtivoParaMotorista: jest.fn(async () => false),
      ajustesDoPeriodo: jest.fn(async () => ({
        creditoCorrecaoMin: 0,
        debitoMin: 0,
        ajustes: [],
      })),
    } as any;

    const service = new IndicadoresService(
      prismaMock,
      tenantMock,
      holeriteMock,
      bancoHorasMock,
    );
    return { service, prismaMock, tenantMock, holeriteMock, bancoHorasMock };
  }

  it('agrega os totais de todos os motoristas somando os totais do HoleriteService (nunca duplica o cálculo)', async () => {
    const { service } = criarServiceComMocks();
    const painel = await service.painel(
      'grupo-A',
      new Date('2026-09-01'),
      new Date('2026-09-30'),
    );

    expect(painel.totais.direcaoMin).toBe(1000);
    expect(painel.totais.esperaMin).toBe(150);
    expect(painel.totais.extraMin).toBe(120);
    expect(painel.totais.noturnoMin).toBe(60);
  });

  it('calcula os percentuais derivados corretamente (extra/direção, espera/total, noturno/direção)', async () => {
    const { service } = criarServiceComMocks();
    const painel = await service.painel(
      'grupo-A',
      new Date('2026-09-01'),
      new Date('2026-09-30'),
    );

    // extra/direção = 120/1000 = 12%
    expect(painel.totais.percentualExtraSobreDirecao).toBe(12);
    // espera/(direção+espera) = 150/1150 ≈ 13%
    expect(painel.totais.percentualEsperaSobreTotal).toBeCloseTo(13, 0);
  });

  it('agrega alertas por severidade e marca risco de fraude apenas para os tipos corretos', async () => {
    const { service } = criarServiceComMocks();
    const painel = await service.painel(
      'grupo-A',
      new Date('2026-09-01'),
      new Date('2026-09-30'),
    );

    expect(painel.totais.alertas.total).toBe(2);
    expect(painel.totais.alertas.criticos).toBe(1);
    expect(painel.totais.alertas.atencao).toBe(1);
    expect(painel.totais.alertas.riscoFraude).toBe(1); // só VELOCIDADE_IMPOSSIVEL_ENTRE_REGISTROS é risco de fraude
  });

  it('ordena o ranking de horas extras do maior para o menor', async () => {
    const { service } = criarServiceComMocks();
    const painel = await service.painel(
      'grupo-A',
      new Date('2026-09-01'),
      new Date('2026-09-30'),
    );

    expect(painel.rankingHorasExtras[0].motoristaId).toBe('m1');
    expect(painel.rankingHorasExtras[0].valorMin).toBe(120);
  });

  it('filtra por um único motorista quando motoristaId é informado, e confere o tenant', async () => {
    const { service, prismaMock, tenantMock } = criarServiceComMocks({
      motoristas: [{ id: 'm1', nome: 'Ana' }],
    });
    await service.painel(
      'grupo-A',
      new Date('2026-09-01'),
      new Date('2026-09-30'),
      'm1',
    );

    expect(tenantMock.verificarMotoristaNoGrupo).toHaveBeenCalledWith(
      'm1',
      'grupo-A',
    );
    expect(prismaMock.motorista.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'm1' }) }),
    );
  });

  it('nunca expõe nenhum campo de valor monetário no resultado (restrição explícita do usuário)', async () => {
    const { service } = criarServiceComMocks();
    const painel = await service.painel(
      'grupo-A',
      new Date('2026-09-01'),
      new Date('2026-09-30'),
    );

    const textoJson = JSON.stringify(painel).toLowerCase();
    expect(textoJson).not.toMatch(/valor.*hora|salario|r\$|reais/);
  });

  it('exportarCsv gera uma linha por dia e uma linha de total por motorista, só com horas (sem R$)', async () => {
    const { service } = criarServiceComMocks({
      motoristas: [{ id: 'm1', nome: 'Ana' }],
    });
    const csv = await service.exportarCsv(
      'grupo-A',
      new Date('2026-09-01'),
      new Date('2026-09-30'),
    );

    const linhas = csv.split('\n');
    expect(linhas[0]).toBe(
      'motorista,dia,horas_direcao,horas_espera,horas_normais,horas_extras,horas_adicional_noturno,horas_indefinido',
    );
    expect(linhas[1]).toContain('Ana');
    expect(linhas[1]).toContain('2026-09-01');
    expect(linhas[2]).toContain('Ana (TOTAL)');
    expect(csv).not.toMatch(/R\$/);
  });

  describe('banco de horas (Rodada 37)', () => {
    it('quando nenhum motorista tem banco de horas ligado, o total vem zerado e ativo=false', async () => {
      const { service } = criarServiceComMocks();
      const painel = await service.painel(
        'grupo-A',
        new Date('2026-09-01'),
        new Date('2026-09-30'),
      );

      expect(painel.motoristasComBancoHorasAtivo).toBe(0);
      expect(painel.totais.bancoHoras).toEqual({
        ativo: false,
        creditoExtraMin: 0,
        creditoCorrecaoMin: 0,
        debitoMin: 0,
        saldoMin: 0,
      });
      expect(
        painel.tendenciaDiaria.every(
          (d) => d.bancoHorasSaldoAcumuladoMin === 0,
        ),
      ).toBe(true);
    });

    it('quando o motorista tem banco de horas ligado, credita a hora extra apurada e debita os ajustes do período', async () => {
      const { service, bancoHorasMock } = criarServiceComMocks({
        motoristas: [{ id: 'm1', nome: 'Ana' }],
      });
      bancoHorasMock.estaAtivoParaMotorista.mockResolvedValue(true);
      bancoHorasMock.ajustesDoPeriodo.mockResolvedValue({
        creditoCorrecaoMin: 30,
        debitoMin: 50,
        ajustes: [
          {
            data: new Date('2026-09-01'),
            tipo: 'CORRECAO_CREDITO',
            minutos: 30,
          },
          { data: new Date('2026-09-02'), tipo: 'COMPENSACAO', minutos: 50 },
        ],
      });

      const painel = await service.painel(
        'grupo-A',
        new Date('2026-09-01'),
        new Date('2026-09-30'),
        'm1',
      );
      const m1 = painel.motoristas[0];

      // m1 tem extraMin=120 (ver resultadosPorMotorista padrão) => saldo = 120 + 30 - 50 = 100
      expect(m1.bancoHoras).toEqual({
        ativo: true,
        creditoExtraMin: 120,
        creditoCorrecaoMin: 30,
        debitoMin: 50,
        saldoMin: 100,
      });
      expect(painel.motoristasComBancoHorasAtivo).toBe(1);
      expect(painel.totais.bancoHoras.saldoMin).toBe(100);
    });

    it('motorista sem banco de horas ligado nunca aparece com saldo/crédito, mesmo tendo hora extra', async () => {
      const { service } = criarServiceComMocks({
        motoristas: [{ id: 'm2', nome: 'Bruno' }],
      });
      const painel = await service.painel(
        'grupo-A',
        new Date('2026-09-01'),
        new Date('2026-09-30'),
        'm2',
      );

      expect(painel.motoristas[0].bancoHoras).toEqual({
        ativo: false,
        creditoExtraMin: 0,
        creditoCorrecaoMin: 0,
        debitoMin: 0,
        saldoMin: 0,
      });
    });

    it('a tendência diária acumula o saldo de banco de horas dia após dia (crédito da hora extra do dia menos débito do ajuste)', async () => {
      const { service, bancoHorasMock } = criarServiceComMocks({
        motoristas: [{ id: 'm1', nome: 'Ana' }],
      });
      bancoHorasMock.estaAtivoParaMotorista.mockResolvedValue(true);
      bancoHorasMock.ajustesDoPeriodo.mockResolvedValue({
        creditoCorrecaoMin: 0,
        debitoMin: 40,
        ajustes: [
          { data: new Date('2026-09-01'), tipo: 'PAGAMENTO', minutos: 40 },
        ],
      });

      const painel = await service.painel(
        'grupo-A',
        new Date('2026-09-01'),
        new Date('2026-09-30'),
        'm1',
      );
      // dia 2026-09-01: crédito 120 (extraMin do dia), débito 40 (pagamento) => saldo acumulado 80
      const dia1 = painel.tendenciaDiaria.find((d) => d.dia === '2026-09-01');
      expect(dia1?.bancoHorasSaldoAcumuladoMin).toBe(80);
    });
  });
});
