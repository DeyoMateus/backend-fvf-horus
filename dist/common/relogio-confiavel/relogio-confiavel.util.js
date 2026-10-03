"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOLERANCIA_DIVERGENCIA_RELOGIO_CONFIAVEL_MIN = void 0;
exports.calcularDivergenciaRelogioConfiavelMin = calcularDivergenciaRelogioConfiavelMin;
exports.TOLERANCIA_DIVERGENCIA_RELOGIO_CONFIAVEL_MIN = 5;
function calcularDivergenciaRelogioConfiavelMin(timestampEvento, elapsedRealtimeMsDoEvento, amostra) {
    const deltaParedeMs = timestampEvento.getTime() - amostra.horaServidorNoMomento.getTime();
    const deltaMonotonicoMs = elapsedRealtimeMsDoEvento - amostra.elapsedRealtimeMsNoMomento;
    return Math.abs(deltaParedeMs - deltaMonotonicoMs) / 60000;
}
//# sourceMappingURL=relogio-confiavel.util.js.map