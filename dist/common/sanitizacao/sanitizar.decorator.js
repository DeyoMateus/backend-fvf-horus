"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sanitizar = Sanitizar;
exports.SomenteDigitos = SomenteDigitos;
exports.NormalizarTelefone = NormalizarTelefone;
const class_transformer_1 = require("class-transformer");
function Sanitizar() {
    return (0, class_transformer_1.Transform)(({ value }) => {
        if (typeof value !== 'string')
            return value;
        return value
            .replace(/<[^>]*>/g, '')
            .replace(/[\u0000-\u001F\u007F]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    });
}
function SomenteDigitos() {
    return (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? value.replace(/\D/g, '') : value);
}
function NormalizarTelefone() {
    return (0, class_transformer_1.Transform)(({ value }) => {
        if (typeof value !== 'string')
            return value;
        const comMais = value.trim().startsWith('+');
        const digitos = value.replace(/\D/g, '');
        return comMais ? `+${digitos}` : digitos;
    });
}
//# sourceMappingURL=sanitizar.decorator.js.map