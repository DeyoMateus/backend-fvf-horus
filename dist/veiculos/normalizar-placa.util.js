"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizarPlaca = normalizarPlaca;
function normalizarPlaca(placa) {
    return placa.trim().toUpperCase().replace(/\s+/g, '');
}
//# sourceMappingURL=normalizar-placa.util.js.map