"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantContext = exports.SISTEMA = void 0;
const node_async_hooks_1 = require("node:async_hooks");
exports.SISTEMA = '__sistema__';
const armazenamento = new node_async_hooks_1.AsyncLocalStorage();
exports.TenantContext = {
    paraGrupo(grupoId, fn) {
        return armazenamento.run({ grupoId }, fn);
    },
    paraSistema(fn) {
        return armazenamento.run({ grupoId: exports.SISTEMA }, fn);
    },
    atual() {
        return armazenamento.getStore();
    },
};
//# sourceMappingURL=tenant-context.js.map