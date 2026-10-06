"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executarComFusoDoCliente = executarComFusoDoCliente;
exports.offsetDoCliente = offsetDoCliente;
exports.agoraDoCliente = agoraDoCliente;
exports.instanteDoCliente = instanteDoCliente;
exports.instanteDoEvento = instanteDoEvento;
const node_async_hooks_1 = require("node:async_hooks");
const fuso_brasil_util_1 = require("./fuso-brasil.util");
const armazenamento = new node_async_hooks_1.AsyncLocalStorage();
function executarComFusoDoCliente(offsetMin, fn) {
    return armazenamento.run({ offsetMin }, fn);
}
function offsetDoCliente() {
    return armazenamento.getStore()?.offsetMin ?? fuso_brasil_util_1.OFFSET_PADRAO_MIN;
}
function agoraDoCliente() {
    const off = offsetDoCliente();
    return `${(0, fuso_brasil_util_1.formatarDataHoraBrt)(new Date(), off)} (${(0, fuso_brasil_util_1.rotuloFuso)(off)})`;
}
function instanteDoCliente(data) {
    const off = offsetDoCliente();
    return `${(0, fuso_brasil_util_1.formatarDataHoraBrt)(data, off)} (${(0, fuso_brasil_util_1.rotuloFuso)(off)})`;
}
function instanteDoEvento(data, offsetEventoMin) {
    if (offsetEventoMin == null)
        return instanteDoCliente(data);
    const texto = (0, fuso_brasil_util_1.formatarDataHoraBrt)(data, offsetEventoMin);
    return offsetEventoMin === offsetDoCliente()
        ? texto
        : `${texto} (${(0, fuso_brasil_util_1.rotuloFuso)(offsetEventoMin)})`;
}
//# sourceMappingURL=fuso-contexto.js.map