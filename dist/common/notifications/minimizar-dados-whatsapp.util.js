"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nomeAbreviado = nomeAbreviado;
exports.mascararDadosPessoais = mascararDadosPessoais;
function nomeAbreviado(nomeCompleto) {
    const partes = (nomeCompleto ?? '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0)
        return 'Motorista';
    if (partes.length === 1)
        return partes[0];
    const ultimo = partes[partes.length - 1];
    return `${partes[0]} ${ultimo.charAt(0).toUpperCase()}.`;
}
function mascararDadosPessoais(texto) {
    return (texto
        .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF omitido]')
        .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[e-mail omitido]')
        .replace(/-?\d{1,3}\.\d{4,},?\s*-?\d{1,3}\.\d{4,}/g, '[localização omitida]')
        .replace(/(\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, '[telefone omitido]'));
}
//# sourceMappingURL=minimizar-dados-whatsapp.util.js.map