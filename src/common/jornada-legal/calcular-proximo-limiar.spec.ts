import { jest } from '@test/jest-globals';
import { JornadaLegalService } from './jornada-legal.service';

/**
 * Testes de regressão da Rodada 21: `calcularProximoLimiar` é a peça
 * nova que permite agendar um único job futuro por motorista (ver
 * `VerificacaoJornadaAgendadaService`) em vez de escanear todo mundo
 * periodicamente , cobre diretamente essa função pura, sem precisar
 * dos mocks de `RegistrosJornadaService`.
 */
describe('JornadaLegalService.calcularProximoLimiar (Rodada 21)', () => {
  const service = new JornadaLegalService();

  it('motorista dirigindo continuamente (nenhum limiar atingido ainda) propõe o menor limiar futuro , direção contínua de 5h (ATENCAO), não jornada de 8h', () => {
    const registros = [
      {
        id: 'r1',
        motoristaId: 'motorista-1',
        tipoEvento: 'INICIO_JORNADA',
        timestampEvento: new Date('2026-09-22T08:00:00.000Z'),
        sequencial: 1,
      },
      {
        id: 'r2',
        motoristaId: 'motorista-1',
        tipoEvento: 'INICIO_DIRECAO',
        timestampEvento: new Date('2026-09-22T08:00:00.000Z'),
        sequencial: 2,
      },
    ] as any;

    // 1h de direção contínua já decorrida (08:00 -> 09:00) , faltam 4h
    // (240min) pra ATENCAO de direção contínua (5h) e 7h pra ATENCAO de
    // jornada de direção (8h). O menor dos dois é 240min.
    const agora = new Date('2026-09-22T09:00:00.000Z');
    const resultado = service.calcularProximoLimiar(registros, agora);

    expect(resultado).not.toBeNull();
    expect(resultado!.emMs).toBe(240 * 60000);
  });

  it('motorista em espera de carga/descarga propõe o limiar INFO (3h) quando ainda não passou dele', () => {
    const registros = [
      {
        id: 'r1',
        motoristaId: 'motorista-1',
        tipoEvento: 'INICIO_JORNADA',
        timestampEvento: new Date('2026-09-22T08:00:00.000Z'),
        sequencial: 1,
      },
      {
        id: 'r2',
        motoristaId: 'motorista-1',
        tipoEvento: 'ESPERA_CARGA_DESCARGA',
        timestampEvento: new Date('2026-09-22T08:00:00.000Z'),
        sequencial: 2,
      },
    ] as any;

    // 1h de espera já decorrida , faltam 2h (120min) pro limiar INFO (3h).
    const agora = new Date('2026-09-22T09:00:00.000Z');
    const resultado = service.calcularProximoLimiar(registros, agora);

    expect(resultado).not.toBeNull();
    expect(resultado!.emMs).toBe(120 * 60000);
  });

  it('motorista parado (último evento FIM_DIRECAO, nada em aberto) não tem limiar futuro , retorna null', () => {
    const registros = [
      {
        id: 'r1',
        motoristaId: 'motorista-1',
        tipoEvento: 'INICIO_JORNADA',
        timestampEvento: new Date('2026-09-22T08:00:00.000Z'),
        sequencial: 1,
      },
      {
        id: 'r2',
        motoristaId: 'motorista-1',
        tipoEvento: 'INICIO_DIRECAO',
        timestampEvento: new Date('2026-09-22T08:00:00.000Z'),
        sequencial: 2,
      },
      {
        id: 'r3',
        motoristaId: 'motorista-1',
        tipoEvento: 'FIM_DIRECAO',
        timestampEvento: new Date('2026-09-22T09:00:00.000Z'),
        sequencial: 3,
      },
    ] as any;

    const resultado = service.calcularProximoLimiar(
      registros,
      new Date('2026-09-22T09:30:00.000Z'),
    );
    expect(resultado).toBeNull();
  });

  it('motorista já além do limite crítico de direção contínua E de jornada de direção não tem mais nenhum limiar a esperar , retorna null', () => {
    const registros = [
      {
        id: 'r1',
        motoristaId: 'motorista-1',
        tipoEvento: 'INICIO_JORNADA',
        timestampEvento: new Date('2026-09-22T08:00:00.000Z'),
        sequencial: 1,
      },
      {
        id: 'r2',
        motoristaId: 'motorista-1',
        tipoEvento: 'INICIO_DIRECAO',
        timestampEvento: new Date('2026-09-22T08:00:00.000Z'),
        sequencial: 2,
      },
    ] as any;

    // 11h de direção contínua ininterrupta , já passou dos 5h30 (crítico
    // de direção contínua) E dos 10h (crítico de jornada de direção).
    // Nada mais a esperar sem um evento novo.
    const agora = new Date('2026-09-22T19:00:00.000Z');
    const resultado = service.calcularProximoLimiar(registros, agora);
    expect(resultado).toBeNull();
  });

  it('sem nenhum registro, retorna null (nada a avaliar)', () => {
    const resultado = service.calcularProximoLimiar([] as any, new Date());
    expect(resultado).toBeNull();
  });
});
