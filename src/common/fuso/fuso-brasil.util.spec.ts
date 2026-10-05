import {
  marcarHorario,
  renderizarHorarios,
  OFFSET_PADRAO_MIN,
  chaveDiaBrt,
  construirLinhaDoTempoFuso,
  dividirPorDiaCivil,
  fimDePeriodoBrt,
  formatarDataHoraBrt,
  inicioDePeriodoBrt,
  inicioDoDiaBrt,
  minutosNoturnosEntre,
  offsetEstimadoPorLongitude,
  offsetNoInstante,
  offsetPadraoDaEmpresa,
  offsetValido,
  proximaMeiaNoiteBrt,
  resolverFusoDoRegistro,
  rotuloFuso,
} from './fuso-brasil.util';

describe('fuso-brasil.util (America/Sao_Paulo, UTC-3 fixo)', () => {
  it('chaveDiaBrt: 22h BRT ainda é o mesmo dia civil (01:00Z do dia seguinte)', () => {
    expect(chaveDiaBrt(new Date('2026-09-11T01:00:00Z'))).toBe('2026-09-10');
  });

  it('chaveDiaBrt: 00:30 BRT já é o dia seguinte (03:30Z)', () => {
    expect(chaveDiaBrt(new Date('2026-09-11T03:30:00Z'))).toBe('2026-09-11');
  });

  it('inicioDoDiaBrt / proximaMeiaNoiteBrt', () => {
    const t = new Date('2026-09-11T01:00:00Z'); // 22h BRT de 10/09
    expect(inicioDoDiaBrt(t).toISOString()).toBe('2026-09-10T03:00:00.000Z');
    expect(proximaMeiaNoiteBrt(t).toISOString()).toBe(
      '2026-09-11T03:00:00.000Z',
    );
  });

  it('inicioDePeriodoBrt: "só data" vira 00:00 BRT; instante real passa direto', () => {
    expect(
      inicioDePeriodoBrt(new Date('2026-09-01T00:00:00Z')).toISOString(),
    ).toBe('2026-09-01T03:00:00.000Z');
    const real = new Date('2026-09-01T10:15:00Z');
    expect(inicioDePeriodoBrt(real)).toBe(real);
  });

  it('fimDePeriodoBrt: "só data" vira 23:59:59.999 BRT; instante real passa direto', () => {
    expect(
      fimDePeriodoBrt(new Date('2026-09-30T00:00:00Z')).toISOString(),
    ).toBe('2026-10-01T02:59:59.999Z');
    const real = new Date('2026-09-30T20:00:00Z');
    expect(fimDePeriodoBrt(real)).toBe(real);
  });

  it('formatarDataHoraBrt escreve a hora de Brasília', () => {
    expect(formatarDataHoraBrt(new Date('2026-09-11T01:05:00Z'))).toBe(
      '10/09/2026 22:05',
    );
  });

  describe('Rodada 146: deslocamento por fuso', () => {
    it('sem argumento usa Brasília (-180), idêntico ao comportamento anterior', () => {
      expect(OFFSET_PADRAO_MIN).toBe(-180);
      const t = new Date('2026-09-11T01:00:00Z');
      expect(chaveDiaBrt(t)).toBe(chaveDiaBrt(t, -180));
      expect(inicioDoDiaBrt(t).toISOString()).toBe(
        inicioDoDiaBrt(t, -180).toISOString(),
      );
    });

    it('Cuiabá (-240): 01:00Z é 21:00 do dia 10; meia-noite local é 04:00Z', () => {
      const t = new Date('2026-09-11T01:00:00Z');
      expect(chaveDiaBrt(t, -240)).toBe('2026-09-10');
      expect(inicioDoDiaBrt(t, -240).toISOString()).toBe(
        '2026-09-10T04:00:00.000Z',
      );
      expect(proximaMeiaNoiteBrt(t, -240).toISOString()).toBe(
        '2026-09-11T04:00:00.000Z',
      );
      expect(formatarDataHoraBrt(t, -240)).toBe('10/09/2026 21:00');
    });

    it('Acre (-300): período "só data" vira 05:00Z e fim 04:59:59.999Z do dia seguinte', () => {
      expect(
        inicioDePeriodoBrt(new Date('2026-09-01T00:00:00Z'), -300).toISOString(),
      ).toBe('2026-09-01T05:00:00.000Z');
      expect(
        fimDePeriodoBrt(new Date('2026-09-30T00:00:00Z'), -300).toISOString(),
      ).toBe('2026-10-01T04:59:59.999Z');
    });

    it('offsetPadraoDaEmpresa e rotuloFuso', () => {
      expect(offsetPadraoDaEmpresa('America/Cuiaba')).toBe(-240);
      expect(offsetPadraoDaEmpresa('America/Rio_Branco')).toBe(-300);
      expect(offsetPadraoDaEmpresa(undefined)).toBe(-180);
      expect(offsetPadraoDaEmpresa('Fuso/Desconhecido')).toBe(-180);
      expect(rotuloFuso(-240)).toBe('UTC-4');
    });

    it('offsetValido só aceita hora cheia dentro da faixa brasileira', () => {
      expect(offsetValido(-180)).toBe(true);
      expect(offsetValido(-300)).toBe(true);
      expect(offsetValido(-120)).toBe(true);
      expect(offsetValido(0)).toBe(false);
      expect(offsetValido(-210)).toBe(false);
      expect(offsetValido('-180')).toBe(false);
      expect(offsetValido(undefined)).toBe(false);
    });

    it('offsetEstimadoPorLongitude para cidades de referência', () => {
      expect(offsetEstimadoPorLongitude(-46.6)).toBe(-180); // São Paulo
      expect(offsetEstimadoPorLongitude(-56.1)).toBe(-240); // Cuiabá
      expect(offsetEstimadoPorLongitude(-60.0)).toBe(-240); // Manaus
      expect(offsetEstimadoPorLongitude(-67.8)).toBe(-300); // Rio Branco
    });

    it('resolverFusoDoRegistro: app antigo (sem fuso) devolve null, nunca inventa', () => {
      expect(resolverFusoDoRegistro(undefined, -23.5, -46.6).offsetMin).toBeNull();
    });

    it('resolverFusoDoRegistro: coerente com o GPS vale; sem GPS vale o do aparelho', () => {
      expect(resolverFusoDoRegistro(-240, -15.6, -56.1)).toEqual({
        offsetMin: -240,
        divergenteDoGps: false,
        informadoPeloAparelho: null,
      });
      expect(resolverFusoDoRegistro(-240, null, null).offsetMin).toBe(-240);
    });

    it('resolverFusoDoRegistro: 1h de diferença é tolerada (fronteira entre fusos)', () => {
      // Foz do Iguaçu (-54.6) está em UTC-3, mas a longitude sugere -4.
      const r = resolverFusoDoRegistro(-180, -25.5, -54.6);
      expect(r.offsetMin).toBe(-180);
      expect(r.divergenteDoGps).toBe(false);
    });

    it('resolverFusoDoRegistro: aparelho contradiz o GPS por 2h+ => GPS manda e marca divergência', () => {
      const r = resolverFusoDoRegistro(-300, -23.5, -46.6);
      expect(r).toEqual({
        offsetMin: -180,
        divergenteDoGps: true,
        informadoPeloAparelho: -300,
      });
    });
  });

  describe('Rodada 146: linha do tempo de fuso e hora noturna pelo fuso atual', () => {
    const t = (iso: string) => new Date(iso).getTime();

    it('duração MT -> SP é a diferença de instantes: 11h reais, sem hora fantasma', () => {
      const inicioMt = new Date('2026-09-10T12:00:00Z'); // 08:00 em Cuiabá
      const fimSp = new Date('2026-09-10T23:00:00Z'); // 20:00 em São Paulo
      expect((fimSp.getTime() - inicioMt.getTime()) / 3_600_000).toBe(11);
      expect(formatarDataHoraBrt(inicioMt, -240)).toBe('10/09/2026 08:00');
      expect(formatarDataHoraBrt(fimSp, -180)).toBe('10/09/2026 20:00');
    });

    it('minutosNoturnosEntre usa a parede do fuso: 21h-23h em Cuiabá = 60 min', () => {
      // 21:00-23:00 em Cuiabá = 01:00Z-03:00Z
      expect(
        minutosNoturnosEntre(
          new Date('2026-09-11T01:00:00Z'),
          new Date('2026-09-11T03:00:00Z'),
          -240,
        ),
      ).toBe(60);
      // o mesmo intervalo em Brasília (22h-24h) seriam 120 min
      expect(
        minutosNoturnosEntre(
          new Date('2026-09-11T01:00:00Z'),
          new Date('2026-09-11T03:00:00Z'),
          -180,
        ),
      ).toBe(120);
    });

    it('minutosNoturnosEntre cobre vários dias (20h de trecho cruzando a madrugada)', () => {
      // 20:00 de 10/09 às 08:00 de 11/09 em Brasília: 22h-05h = 7h
      expect(
        minutosNoturnosEntre(
          new Date('2026-09-10T23:00:00Z'),
          new Date('2026-09-11T11:00:00Z'),
          -180,
        ),
      ).toBe(7 * 60);
    });

    it('linha do tempo: troca localizada pela amostra que já está no fuso seguinte', () => {
      const linha = construirLinhaDoTempoFuso(
        [
          { t: t('2026-09-10T12:00:00Z'), offsetMin: -240 }, // sai de MT
          { t: t('2026-09-10T23:00:00Z'), offsetMin: -180 }, // chega em SP
        ],
        [
          { t: t('2026-09-10T15:00:00Z'), longitude: -55.0 }, // ainda -4
          { t: t('2026-09-10T18:00:00Z'), longitude: -50.0 }, // já -3
        ],
      );
      expect(offsetNoInstante(linha, t('2026-09-10T13:00:00Z'))).toBe(-240);
      expect(offsetNoInstante(linha, t('2026-09-10T17:59:00Z'))).toBe(-240);
      expect(offsetNoInstante(linha, t('2026-09-10T18:00:00Z'))).toBe(-180);
      expect(offsetNoInstante(linha, t('2026-09-10T22:00:00Z'))).toBe(-180);
    });

    it('linha do tempo sem amostra: a troca vale a partir do ponto seguinte', () => {
      const linha = construirLinhaDoTempoFuso(
        [
          { t: t('2026-09-10T12:00:00Z'), offsetMin: -240 },
          { t: t('2026-09-10T23:00:00Z'), offsetMin: -180 },
        ],
        [],
      );
      expect(offsetNoInstante(linha, t('2026-09-10T22:59:00Z'))).toBe(-240);
      expect(offsetNoInstante(linha, t('2026-09-10T23:00:00Z'))).toBe(-180);
    });

    it('sem registros usa o padrão informado', () => {
      expect(offsetNoInstante([], t('2026-09-10T12:00:00Z'), -240)).toBe(-240);
    });

    it('registro antigo (null) assume o padrão e não cria troca', () => {
      const linha = construirLinhaDoTempoFuso(
        [
          { t: t('2026-09-10T12:00:00Z'), offsetMin: null },
          { t: t('2026-09-10T15:00:00Z'), offsetMin: -180 },
        ],
        [],
      );
      expect(linha).toHaveLength(1);
      expect(offsetNoInstante(linha, t('2026-09-10T14:00:00Z'))).toBe(-180);
    });

    it('dividirPorDiaCivil corta na meia-noite do fuso E na troca de fuso', () => {
      // Sai de MT às 18:00 locais (22:00Z) e chega em SP às 03:00 locais (06:00Z):
      // 8h reais. A troca de fuso acontece às 01:00Z.
      const linha = construirLinhaDoTempoFuso(
        [
          { t: t('2026-09-10T22:00:00Z'), offsetMin: -240 },
          { t: t('2026-09-11T06:00:00Z'), offsetMin: -180 },
        ],
        [{ t: t('2026-09-11T01:00:00Z'), longitude: -50.0 }],
      );
      const pedacos = dividirPorDiaCivil(
        new Date('2026-09-10T22:00:00Z'),
        new Date('2026-09-11T06:00:00Z'),
        linha,
      );
      expect(
        pedacos.map((p) => [
          p.inicio.toISOString(),
          p.fim.toISOString(),
          p.offsetMin,
        ]),
      ).toEqual([
        // 18:00-21:00 em MT (22:00Z-01:00Z)
        ['2026-09-10T22:00:00.000Z', '2026-09-11T01:00:00.000Z', -240],
        // já em SP: 22:00 do dia 10 até a meia-noite de SP (03:00Z)
        ['2026-09-11T01:00:00.000Z', '2026-09-11T03:00:00.000Z', -180],
        // madrugada do dia 11 em SP (03:00Z-06:00Z)
        ['2026-09-11T03:00:00.000Z', '2026-09-11T06:00:00.000Z', -180],
      ]);
      // soma das durações = 8h reais
      const totalMin = pedacos.reduce(
        (a, p) => a + (p.fim.getTime() - p.inicio.getTime()) / 60000,
        0,
      );
      expect(totalMin).toBe(8 * 60);
      // noturno pela parede de cada fuso: MT 18-21h = 0; SP 22h-24h = 120; SP 00h-03h = 180
      const noturno = pedacos.reduce(
        (a, p) => a + minutosNoturnosEntre(p.inicio, p.fim, p.offsetMin),
        0,
      );
      expect(noturno).toBe(300);
    });
  });
});

describe('Rodada 148: horário dentro de mensagens por destinatário', () => {
  it('a mesma mensagem mostra 07h em Brasília e 06h em Cuiabá', () => {
    const msg = `Aparelho com hora ${marcarHorario(new Date('2026-10-05T10:00:00.000Z'))} suspeita.`;
    expect(renderizarHorarios(msg, -180)).toBe('Aparelho com hora 05/10/2026 07:00 suspeita.');
    expect(renderizarHorarios(msg, -240)).toBe('Aparelho com hora 05/10/2026 06:00 suspeita.');
  });

  it('texto sem marcador passa intacto', () => {
    expect(renderizarHorarios('Jornada de 08:00', -180)).toBe('Jornada de 08:00');
  });
});
