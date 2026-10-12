import { TipoEvento } from '@prisma/client';
import { fimSeguidoDeInicioDeOutraAtividade as ok } from './registros-jornada.service';

describe('horário igual entre atividades (Rodada 223)', () => {
  it('permite fim de descanso + início de direção (e demais fim + início de outra atividade)', () => {
    expect(ok(TipoEvento.FIM_DESCANSO, TipoEvento.INICIO_DIRECAO)).toBe(true);
    expect(ok(TipoEvento.FIM_DIRECAO, TipoEvento.INICIO_DESCANSO)).toBe(true);
    expect(ok(TipoEvento.FIM_DIRECAO, TipoEvento.ESPERA_CARGA_DESCARGA)).toBe(true);
    expect(ok(TipoEvento.FIM_DESCARREGAMENTO, TipoEvento.INICIO_DIRECAO)).toBe(true);
  });

  it('continua proibido início + fim da mesma atividade e o fim seguido de início da mesma', () => {
    expect(ok(TipoEvento.INICIO_DESCANSO, TipoEvento.FIM_DESCANSO)).toBe(false);
    expect(ok(TipoEvento.INICIO_DIRECAO, TipoEvento.FIM_DIRECAO)).toBe(false);
    expect(ok(TipoEvento.FIM_DESCANSO, TipoEvento.INICIO_DESCANSO)).toBe(false);
    expect(ok(TipoEvento.FIM_DIRECAO, TipoEvento.INICIO_DIRECAO)).toBe(false);
    expect(ok(TipoEvento.INICIO_DIRECAO, TipoEvento.INICIO_DESCANSO)).toBe(false);
  });
});
