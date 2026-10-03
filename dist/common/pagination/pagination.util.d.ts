export declare const TAMANHO_PAGINA_PADRAO = 50;
export declare const TAMANHO_PAGINA_MAXIMO = 200;
export interface PaginacaoNormalizada {
    skip: number;
    take: number;
    page: number;
    pageSize: number;
}
export declare function normalizarPaginacao(page?: number, pageSize?: number): PaginacaoNormalizada;
