/**
 * Rodada 213/215 (LGPD): todo usuário autenticado do painel da empresa
 * (ADMIN e GESTOR/analista) vê a localização do motorista (coordenadas e
 * mapa). A proteção é a TRILHA: cada consulta é registrada na auditoria.
 * Qualquer outro papel (ou ausência de papel) não recebe coordenadas.
 */

/** Papéis do painel autorizados a ver coordenadas de GPS. */
export function podeVerLocalizacao(papel: string | undefined | null): boolean {
  return papel === 'ADMIN' || papel === 'GESTOR';
}

const CAMPOS_COORDENADA = new Set(['latitude', 'longitude']);

function ehObjetoSimples(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Devolve uma cópia profunda de `valor` com todo campo `latitude` e
 * `longitude` (em qualquer nível) trocado por `null`. Datas, Decimals do
 * Prisma e demais instâncias de classe são mantidos como estão (só objetos
 * simples e arrays são percorridos). Não altera o original.
 */
export function removerCoordenadas<T>(valor: T): T {
  if (Array.isArray(valor)) {
    return valor.map((v) => removerCoordenadas(v)) as unknown as T;
  }
  if (ehObjetoSimples(valor)) {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor)) {
      saida[chave] = CAMPOS_COORDENADA.has(chave) ? null : removerCoordenadas(v);
    }
    return saida as T;
  }
  return valor;
}
