import { validarSequenciaAjuste } from './validacao-sequencia-ajuste';

const ev = (tipoEvento: any, h: number) => ({
  tipoEvento,
  timestampEvento: new Date(Date.UTC(2026, 9, 1, h)),
});

describe('validarSequenciaAjuste', () => {
  it('sem nenhum registro, só aceita INICIO_JORNADA', () => {
    expect(validarSequenciaAjuste('INICIO_JORNADA', [], []).ok).toBe(true);
    const r = validarSequenciaAjuste('FIM_DIRECAO', [], []);
    expect(r.ok).toBe(false);
    expect(r.mensagem).toContain('Início de jornada');
  });

  it('fecha a direção esquecida (caso isolado)', () => {
    const anteriores = [ev('INICIO_JORNADA', 7), ev('INICIO_DIRECAO', 8)];
    expect(validarSequenciaAjuste('FIM_DIRECAO', anteriores, []).ok).toBe(true);
  });

  it('recusa FIM_JORNADA com a direção ainda aberta', () => {
    const anteriores = [ev('INICIO_JORNADA', 7), ev('INICIO_DIRECAO', 8)];
    const r = validarSequenciaAjuste('FIM_JORNADA', anteriores, []);
    expect(r.ok).toBe(false);
    expect(r.permitidos).toEqual(['FIM_DIRECAO']);
  });

  it('aceita FIM_DIRECAO quando o próximo evento do motorista encaixa depois dele', () => {
    const anteriores = [ev('INICIO_JORNADA', 7), ev('INICIO_DIRECAO', 8)];
    const posteriores = [ev('INICIO_DESCANSO', 12)];
    expect(validarSequenciaAjuste('FIM_DIRECAO', anteriores, posteriores).ok).toBe(true);
  });

  it('recusa FIM_DIRECAO quando o motorista já bateu um FIM_DIRECAO depois (duplicaria o fim)', () => {
    const anteriores = [ev('INICIO_JORNADA', 7), ev('INICIO_DIRECAO', 8)];
    const posteriores = [ev('FIM_DIRECAO', 12)];
    expect(validarSequenciaAjuste('FIM_DIRECAO', anteriores, posteriores).ok).toBe(false);
  });

  it('aceita INICIO_JORNADA depois de FIM_JORNADA', () => {
    const anteriores = [ev('INICIO_JORNADA', 1), ev('FIM_JORNADA', 5)];
    expect(validarSequenciaAjuste('INICIO_JORNADA', anteriores, []).ok).toBe(
      true,
    );
  });
});
