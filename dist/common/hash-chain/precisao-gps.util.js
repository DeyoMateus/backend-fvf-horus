"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arredondarPrecisaoGps = arredondarPrecisaoGps;
exports.arredondarCoordenadaGps = arredondarCoordenadaGps;
function arredondarPrecisaoGps(valor) {
    if (valor === null || valor === undefined || !Number.isFinite(valor)) {
        return null;
    }
    return Math.round(valor * 100) / 100;
}
function arredondarCoordenadaGps(valor) {
    if (valor === null || valor === undefined || !Number.isFinite(valor)) {
        return null;
    }
    return Math.round(valor * 1e7) / 1e7;
}
//# sourceMappingURL=precisao-gps.util.js.map