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
});
