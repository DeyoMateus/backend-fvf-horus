export const TAMANHO_PAGINA_PADRAO = 50;
export const TAMANHO_PAGINA_MAXIMO = 200;

export interface PaginacaoNormalizada {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
}

/**
 * Normaliza `page`/`pageSize` vindos de query string (podem vir undefined,
 * NaN, negativos, ou um número absurdamente grande) pra parâmetros seguros
 * de `skip`/`take` do Prisma. Usado em toda listagem que pode crescer sem
 * limite (motoristas, alertas, documentos de carga) , sem isso, uma
 * empresa com milhares de registros faria o painel carregar tudo de uma
 * vez a cada visita à página, o que não escala.
 */
export function normalizarPaginacao(
  page?: number,
  pageSize?: number,
): PaginacaoNormalizada {
  const paginaSegura =
    Number.isFinite(page) && (page as number) > 0
      ? Math.floor(page as number)
      : 1;
  const tamanhoSeguro =
    Number.isFinite(pageSize) && (pageSize as number) > 0
      ? Math.min(Math.floor(pageSize as number), TAMANHO_PAGINA_MAXIMO)
      : TAMANHO_PAGINA_PADRAO;
  return {
    skip: (paginaSegura - 1) * tamanhoSeguro,
    take: tamanhoSeguro,
    page: paginaSegura,
    pageSize: tamanhoSeguro,
  };
}
