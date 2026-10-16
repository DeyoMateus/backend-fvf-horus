import { JornadaLegalService } from './jornada-legal.service';

/**
 * Rodada 182: a direção é somada entre jornadas encadeadas (intervalo
 * menor que 11h entre FIM_JORNADA e INICIO_JORNADA).
 */
describe('JornadaLegalService , jornadas encadeadas (Rodada 182)', () => {
  const service = new JornadaLegalService();
  let seq = 0;
  const reg = (tipoEvento: string, iso: string) =>
    ({
      id: `r${++seq}`,
      motoristaId: 'm1',
      tipoEvento,
      timestampEvento: new Date(iso),
      sequencial: seq,
    }) as any;

  it('soma a direção das duas jornadas quando o intervalo é menor que 11h', () => {
    const registros = [
      reg('INICIO_JORNADA', '2026-10-05T06:00:00Z'),
      reg('INICIO_DIRECAO', '2026-10-05T06:00:00Z'),
      reg('FIM_DIRECAO', '2026-10-05T11:30:00Z'), // 5h30
      reg('FIM_JORNADA', '2026-10-05T11:30:00Z'),
      reg('INICIO_JORNADA', '2026-10-05T12:30:00Z'), // 1h depois
      reg('INICIO_DIRECAO', '2026-10-05T12:30:00Z'),
    ];
    const ultimo = registros[registros.length - 1];
    const alertas = service.avaliar(
      registros,
      ultimo,
      new Set(),
      new Date('2026-10-05T15:00:00Z'), // +2h30 => 8h no total
    );
    expect(alertas.map((a) => a.tipo)).toContain('JORNADA_DIRECAO_PROXIMA_LIMITE');
  });

  it('não soma quando houve 11h de descanso entre as jornadas', () => {
    const registros = [
      reg('INICIO_JORNADA', '2026-10-05T06:00:00Z'),
      reg('INICIO_DIRECAO', '2026-10-05T06:00:00Z'),
      reg('FIM_DIRECAO', '2026-10-05T11:30:00Z'),
      reg('FIM_JORNADA', '2026-10-05T11:30:00Z'),
      reg('INICIO_JORNADA', '2026-10-06T02:30:00Z'), // 15h depois
      reg('INICIO_DIRECAO', '2026-10-06T02:30:00Z'),
    ];
    const ultimo = registros[registros.length - 1];
    const alertas = service.avaliar(
      registros,
      ultimo,
      new Set(),
      new Date('2026-10-06T05:00:00Z'),
    );
    expect(alertas.map((a) => a.tipo)).not.toContain('JORNADA_DIRECAO_PROXIMA_LIMITE');
  });

  it('intervalo entre jornadas menor que 30 min não zera a direção contínua', () => {
    const registros = [
      reg('INICIO_JORNADA', '2026-10-05T06:00:00Z'),
      reg('INICIO_DIRECAO', '2026-10-05T06:00:00Z'),
      reg('FIM_DIRECAO', '2026-10-05T10:00:00Z'), // 4h
      reg('FIM_JORNADA', '2026-10-05T10:00:00Z'),
      reg('INICIO_JORNADA', '2026-10-05T10:10:00Z'), // 10 min
      reg('INICIO_DIRECAO', '2026-10-05T10:10:00Z'),
    ];
    const ultimo = registros[registros.length - 1];
    const alertas = service.avaliar(
      registros,
      ultimo,
      new Set(),
      new Date('2026-10-05T11:50:00Z'), // 4h + 1h40 = 5h40
    );
    expect(alertas.map((a) => a.tipo)).toContain('DIRECAO_CONTINUA_EXCEDIDA');
  });

  it('Rodada 184: dois INICIO_DIRECAO seguidos aceitam o ponto mas geram alerta de sequência', () => {
    const registros = [
      reg('INICIO_JORNADA', '2026-10-05T06:00:00Z'),
      reg('INICIO_DIRECAO', '2026-10-05T06:00:00Z'),
      reg('INICIO_DIRECAO', '2026-10-05T07:00:00Z'),
    ];
    const alertas = service.avaliar(
      registros,
      registros[2],
      new Set(),
    );
    expect(alertas.map((a) => a.tipo)).toContain(
      'SEQUENCIA_EVENTOS_INCONSISTENTE',
    );
  });

  it('Rodada 184: sequência válida não gera alerta de sequência', () => {
    const registros = [
      reg('INICIO_JORNADA', '2026-10-05T06:00:00Z'),
      reg('INICIO_DIRECAO', '2026-10-05T06:00:00Z'),
      reg('FIM_DIRECAO', '2026-10-05T08:00:00Z'),
    ];
    const alertas = service.avaliar(registros, registros[2], new Set());
    expect(alertas.map((a) => a.tipo)).not.toContain(
      'SEQUENCIA_EVENTOS_INCONSISTENTE',
    );
  });

  it('Rodada 184: jornada aberta há mais de 14h gera alerta (varredura proativa)', () => {
    const registros = [
      reg('INICIO_JORNADA', '2026-10-05T06:00:00Z'),
      reg('INICIO_DESCANSO', '2026-10-05T07:00:00Z'),
    ];
    const alertas = service.avaliar(
      registros,
      registros[1],
      new Set(),
      new Date('2026-10-05T21:00:00Z'), // 15h depois
    );
    expect(alertas.map((a) => a.tipo)).toContain('JORNADA_ABERTA_PROLONGADA');
  });

  it('Rodada 184: 11h sem registros após descanso (jornada esquecida) não soma a direção do dia anterior', () => {
    const registros = [
      reg('INICIO_JORNADA', '2026-10-05T06:00:00Z'),
      reg('INICIO_DIRECAO', '2026-10-05T06:00:00Z'),
      reg('FIM_DIRECAO', '2026-10-05T14:00:00Z'), // 8h
      reg('INICIO_DESCANSO', '2026-10-05T14:10:00Z'),
      reg('FIM_DESCANSO', '2026-10-06T06:00:00Z'), // dormiu
      reg('INICIO_DIRECAO', '2026-10-06T06:05:00Z'),
    ];
    const alertas = service.avaliar(
      registros,
      registros[5],
      new Set(),
      new Date('2026-10-06T08:05:00Z'), // +2h; soma falsa seria 10h
    );
    const tipos = alertas.map((a) => a.tipo);
    expect(tipos).not.toContain('JORNADA_DIRECAO_EXCEDIDA');
    expect(tipos).not.toContain('JORNADA_DIRECAO_PROXIMA_LIMITE');
  });

  describe('Rodada 205 , jornada vazia não zera o descanso interjornada', () => {
    const base = () => [
      reg('INICIO_JORNADA', '2026-10-10T08:00:00Z'),
      reg('INICIO_DIRECAO', '2026-10-10T08:00:00Z'),
      reg('FIM_DIRECAO', '2026-10-10T17:00:00Z'), // 9h
      reg('FIM_JORNADA', '2026-10-10T22:46:00Z'),
    ];

    it('jornada aberta e fechada sem trabalho no meio não gera falso positivo (13h41 desde o último fim com trabalho)', () => {
      const registros = [
        ...base(),
        reg('INICIO_JORNADA', '2026-10-11T08:27:00Z'),
        reg('FIM_JORNADA', '2026-10-11T08:28:00Z'),
        reg('INICIO_JORNADA', '2026-10-11T12:27:00Z'),
      ];
      const alertas = service.avaliar(
        registros,
        registros[registros.length - 1],
        new Set(),
        new Date('2026-10-11T12:27:30Z'),
      );
      expect(alertas.map((a) => a.tipo)).not.toContain(
        'DESCANSO_INTERJORNADA_INSUFICIENTE',
      );
    });

    it('continua alertando quando o descanso real desde a jornada com trabalho é menor que 11h', () => {
      const registros = [
        ...base(),
        reg('INICIO_JORNADA', '2026-10-11T06:00:00Z'),
        reg('FIM_JORNADA', '2026-10-11T06:01:00Z'),
        reg('INICIO_JORNADA', '2026-10-11T07:00:00Z'), // 8h14 desde 22:46
      ];
      const alertas = service.avaliar(
        registros,
        registros[registros.length - 1],
        new Set(),
        new Date('2026-10-11T07:00:30Z'),
      );
      expect(alertas.map((a) => a.tipo)).toContain(
        'DESCANSO_INTERJORNADA_INSUFICIENTE',
      );
    });
  });

  describe('Rodada 225: direção só da jornada atual (8h/10h) além da soma encadeada', () => {
    const base = () => [
      reg('INICIO_JORNADA', '2026-10-05T00:00:00Z'),
      reg('INICIO_DIRECAO', '2026-10-05T00:00:00Z'),
      reg('FIM_DIRECAO', '2026-10-05T10:00:00Z'), // 10h na jornada anterior
      reg('FIM_JORNADA', '2026-10-05T10:00:00Z'),
      reg('INICIO_JORNADA', '2026-10-05T15:00:00Z'), // 5h de descanso (< 11h)
      reg('INICIO_DIRECAO', '2026-10-05T15:00:00Z'),
    ];

    it('com 8h só nesta jornada avisa "perto de 8h" mesmo com a soma já estourada', () => {
      const registros = base();
      const ultimo = registros[registros.length - 1];
      const tipos = service
        .avaliar(
          registros,
          ultimo,
          new Set(['JORNADA_DIRECAO_PROXIMA_LIMITE', 'JORNADA_DIRECAO_EXCEDIDA'] as any),
          new Date('2026-10-05T23:00:00Z'), // +8h
        )
        .map((a) => a.tipo);
      expect(tipos).toContain('JORNADA_ATUAL_DIRECAO_PROXIMA_LIMITE');
      expect(tipos).not.toContain('JORNADA_ATUAL_DIRECAO_EXCEDIDA');
    });

    it('com 10h só nesta jornada avisa "passou de 10h"', () => {
      const registros = base();
      const ultimo = registros[registros.length - 1];
      const tipos = service
        .avaliar(
          registros,
          ultimo,
          new Set(['JORNADA_DIRECAO_EXCEDIDA'] as any),
          new Date('2026-10-06T01:00:00Z'), // +10h
        )
        .map((a) => a.tipo);
      expect(tipos).toContain('JORNADA_ATUAL_DIRECAO_EXCEDIDA');
    });

    it('não repete o aviso já gerado nesta jornada', () => {
      const registros = base();
      const ultimo = registros[registros.length - 1];
      const tipos = service
        .avaliar(
          registros,
          ultimo,
          new Set(['JORNADA_ATUAL_DIRECAO_EXCEDIDA'] as any),
          new Date('2026-10-06T01:00:00Z'),
        )
        .map((a) => a.tipo);
      expect(tipos).not.toContain('JORNADA_ATUAL_DIRECAO_EXCEDIDA');
    });

    it('sem jornada anterior encadeada não gera os avisos novos (os antigos já cobrem)', () => {
      const registros = [
        reg('INICIO_JORNADA', '2026-10-05T00:00:00Z'),
        reg('INICIO_DIRECAO', '2026-10-05T00:00:00Z'),
      ];
      const tipos = service
        .avaliar(
          registros,
          registros[1],
          new Set(),
          new Date('2026-10-05T10:30:00Z'),
        )
        .map((a) => a.tipo);
      expect(tipos).toContain('JORNADA_DIRECAO_EXCEDIDA');
      expect(tipos).not.toContain('JORNADA_ATUAL_DIRECAO_EXCEDIDA');
      expect(tipos).not.toContain('JORNADA_ATUAL_DIRECAO_PROXIMA_LIMITE');
    });

    it('calcularProximoLimiar inclui o limiar de 8h da jornada atual quando a soma já passou dele', () => {
      const registros = base();
      const r = service.calcularProximoLimiar(
        registros,
        new Date('2026-10-05T21:00:00Z'), // 6h na jornada atual (contínua já passou de 5h30); soma 16h
      );
      // faltam 2h para as 8h da jornada atual
      expect(r?.emMs).toBe(2 * 3_600_000);
    });
  });
});

/**
 * Rodada 265: o descanso entre jornadas conta desde o início da pausa de
 * descanso que fechou a jornada, não só desde o "Fim de jornada" registrado
 * depois de acordar.
 */
describe('JornadaLegalService , descanso desde o início da pausa (Rodada 265)', () => {
  const service = new JornadaLegalService();
  let seq = 1000;
  const reg = (tipoEvento: string, iso: string) =>
    ({
      id: `q${++seq}`,
      motoristaId: 'm1',
      tipoEvento,
      timestampEvento: new Date(iso),
      sequencial: seq,
    }) as any;

  const base = () => [
    reg('INICIO_JORNADA', '2026-10-15T12:00:00Z'),
    reg('INICIO_DIRECAO', '2026-10-15T12:00:00Z'),
    reg('FIM_DIRECAO', '2026-10-15T15:00:00Z'), // 3h
    reg('INICIO_DIRECAO', '2026-10-15T17:34:18Z'),
    reg('FIM_DIRECAO', '2026-10-15T21:24:16Z'), // 3h50
    reg('INICIO_DESCANSO', '2026-10-15T21:24:29Z'),
    reg('FIM_DESCANSO', '2026-10-16T05:07:33Z'),
    reg('FIM_JORNADA', '2026-10-16T05:07:45Z'),
  ];

  it('não soma a jornada de ontem quando houve mais de 11h desde o início do descanso', () => {
    const registros = [
      ...base(),
      reg('INICIO_JORNADA', '2026-10-16T15:33:54Z'), // 18h depois de parar
      reg('INICIO_DIRECAO', '2026-10-16T15:43:13Z'),
    ];
    const ultimo = registros[registros.length - 1];
    const alertas = service.avaliar(
      registros,
      ultimo,
      new Set(),
      new Date('2026-10-16T18:12:57Z'), // 2h29 de direção hoje
    );
    const tipos = alertas.map((a) => a.tipo);
    expect(tipos).not.toContain('JORNADA_DIRECAO_PROXIMA_LIMITE');
    expect(tipos).not.toContain('JORNADA_DIRECAO_EXCEDIDA');
  });

  it('ainda soma quando o descanso total é menor que 11h', () => {
    const registros = [
      ...base(),
      reg('INICIO_JORNADA', '2026-10-16T06:00:00Z'), // 8h35 depois de parar
      reg('INICIO_DIRECAO', '2026-10-16T06:10:00Z'),
    ];
    const ultimo = registros[registros.length - 1];
    const alertas = service.avaliar(
      registros,
      ultimo,
      new Set(),
      new Date('2026-10-16T08:40:00Z'), // +2h30 => 9h20 no total
    );
    const alerta = alertas.find((a) => a.tipo === 'JORNADA_DIRECAO_PROXIMA_LIMITE');
    expect(alerta).toBeDefined();
    expect(alerta!.mensagem).toContain('nesta jornada');
    expect(alerta!.mensagem).toContain('jornadas anteriores');
  });
});
