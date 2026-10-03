"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compararPorTimestampEvento = compararPorTimestampEvento;
function compararPorTimestampEvento(a, b) {
    const diff = a.timestampEvento.getTime() - b.timestampEvento.getTime();
    if (diff !== 0)
        return diff;
    return a.sequencial - b.sequencial;
}
//# sourceMappingURL=ordenacao-temporal.util.js.map