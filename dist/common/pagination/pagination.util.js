"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAMANHO_PAGINA_MAXIMO = exports.TAMANHO_PAGINA_PADRAO = void 0;
exports.normalizarPaginacao = normalizarPaginacao;
exports.TAMANHO_PAGINA_PADRAO = 50;
exports.TAMANHO_PAGINA_MAXIMO = 200;
function normalizarPaginacao(page, pageSize) {
    const paginaSegura = Number.isFinite(page) && page > 0
        ? Math.floor(page)
        : 1;
    const tamanhoSeguro = Number.isFinite(pageSize) && pageSize > 0
        ? Math.min(Math.floor(pageSize), exports.TAMANHO_PAGINA_MAXIMO)
        : exports.TAMANHO_PAGINA_PADRAO;
    return {
        skip: (paginaSegura - 1) * tamanhoSeguro,
        take: tamanhoSeguro,
        page: paginaSegura,
        pageSize: tamanhoSeguro,
    };
}
//# sourceMappingURL=pagination.util.js.map