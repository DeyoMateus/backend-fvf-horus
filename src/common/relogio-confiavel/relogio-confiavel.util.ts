/**
 * Rodada 92 , matemática compartilhada entre a checagem nº4 em
 * `RegistrosJornadaService.create` (tempo real, dentro da transação do
 * ledger) e `RelogioConfiavelService.resolverPendencias` (retroativo,
 * quando uma amostra chega depois). As duas comparam a mesma coisa: o
 * quanto o relógio de PAREDE andou entre uma "âncora" (amostra de hora
 * confiável, vinda do SERVIDOR) e um evento, contra o quanto o relógio
 * MONOTÔNICO do aparelho andou no mesmo intervalo , ver o comentário
 * completo em AmostraHoraConfiavel (schema.prisma).
 */

// Mesma ordem de grandeza da tolerância da checagem nº3 (Rodada 88/89):
// folga generosa o bastante pra absorver qualquer deriva legítima de
// rede/NTP sem abrir brecha pro ataque de adiantar/atrasar o relógio.
export const TOLERANCIA_DIVERGENCIA_RELOGIO_CONFIAVEL_MIN = 5;

export interface AmostraHoraConfiavelComparavel {
  horaServidorNoMomento: Date;
  elapsedRealtimeMsNoMomento: number;
}

export function calcularDivergenciaRelogioConfiavelMin(
  timestampEvento: Date,
  elapsedRealtimeMsDoEvento: number,
  amostra: AmostraHoraConfiavelComparavel,
): number {
  const deltaParedeMs =
    timestampEvento.getTime() - amostra.horaServidorNoMomento.getTime();
  const deltaMonotonicoMs =
    elapsedRealtimeMsDoEvento - amostra.elapsedRealtimeMsNoMomento;
  return Math.abs(deltaParedeMs - deltaMonotonicoMs) / 60000;
}
