export declare const TOLERANCIA_DIVERGENCIA_RELOGIO_CONFIAVEL_MIN = 5;
export interface AmostraHoraConfiavelComparavel {
    horaServidorNoMomento: Date;
    elapsedRealtimeMsNoMomento: number;
}
export declare function calcularDivergenciaRelogioConfiavelMin(timestampEvento: Date, elapsedRealtimeMsDoEvento: number, amostra: AmostraHoraConfiavelComparavel): number;
