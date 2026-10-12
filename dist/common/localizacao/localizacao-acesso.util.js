"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.podeVerLocalizacao = podeVerLocalizacao;
exports.removerCoordenadas = removerCoordenadas;
function podeVerLocalizacao(papel) {
    return papel === 'ADMIN' || papel === 'GESTOR';
}
const CAMPOS_COORDENADA = new Set(['latitude', 'longitude']);
function ehObjetoSimples(v) {
    if (v === null || typeof v !== 'object')
        return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
}
function removerCoordenadas(valor) {
    if (Array.isArray(valor)) {
        return valor.map((v) => removerCoordenadas(v));
    }
    if (ehObjetoSimples(valor)) {
        const saida = {};
        for (const [chave, v] of Object.entries(valor)) {
            saida[chave] = CAMPOS_COORDENADA.has(chave) ? null : removerCoordenadas(v);
        }
        return saida;
    }
    return valor;
}
//# sourceMappingURL=localizacao-acesso.util.js.map