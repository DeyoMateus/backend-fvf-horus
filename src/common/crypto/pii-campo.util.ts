import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
} from 'crypto';

/**
 * Criptografia de campos pessoais em repouso (Rodada 199): CPF, CNH e
 * telefone de motoristas e ajudantes.
 *
 * - AES-256-GCM, chaves derivadas por HKDF da CRYPTO_MASTER_KEY (a mesma
 *   chave mestra do envelope encryption; nunca a chave crua).
 * - DETERMINÍSTICA de propósito: o IV é derivado (HMAC) do campo + valor,
 *   então o mesmo CPF gera sempre o mesmo texto cifrado. Isso preserva a
 *   restrição UNIQUE do banco e as buscas por igualdade
 *   (`where: { cpf }`). O que isso revela: só que dois cadastros têm o
 *   mesmo valor (sem o conteúdo). Cada campo tem seu AAD (o nome do
 *   campo), então o texto cifrado do CPF não vale como CNH.
 * - Formato: `enc:v1:` + base64url(iv(12) | tag(16) | cifrado). Valor sem
 *   esse prefixo é tratado como texto puro (dado antigo ainda não
 *   migrado), então a leitura funciona antes, durante e depois da
 *   migração.
 * - Escrita só cifra quando PII_ENCRYPTION_ENABLED=true (a leitura
 *   decifra sempre).
 */
export const PREFIXO_PII = 'enc:v1:';
export const CAMPOS_PII = ['cpf', 'cnh', 'telefone'] as const;
type CampoPii = (typeof CAMPOS_PII)[number];

let chaves: { enc: Buffer; iv: Buffer } | null = null;

function obterChaves() {
  if (chaves) return chaves;
  const hex = process.env.CRYPTO_MASTER_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'CRYPTO_MASTER_KEY ausente ou inválida: necessária para a criptografia de CPF/CNH/telefone.',
    );
  }
  const mestre = Buffer.from(hex, 'hex');
  const derivar = (info: string) =>
    Buffer.from(hkdfSync('sha256', mestre, Buffer.alloc(0), info, 32));
  chaves = { enc: derivar('pii-campo-enc-v1'), iv: derivar('pii-campo-iv-v1') };
  return chaves;
}

/** Só para testes: força recarregar a chave do ambiente. */
export function reiniciarChavesPii(): void {
  chaves = null;
}

export function criptografiaPiiLigada(): boolean {
  return process.env.PII_ENCRYPTION_ENABLED === 'true';
}

export function estaCifrado(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.startsWith(PREFIXO_PII);
}

export function cifrarCampo(campo: CampoPii, valor: string): string {
  if (estaCifrado(valor)) return valor; // idempotente
  const { enc, iv: chaveIv } = obterChaves();
  const iv = createHmac('sha256', chaveIv)
    .update(`${campo}\u0000${valor}`)
    .digest()
    .subarray(0, 12);
  const cifra = createCipheriv('aes-256-gcm', enc, iv);
  cifra.setAAD(Buffer.from(campo));
  const texto = Buffer.concat([cifra.update(valor, 'utf8'), cifra.final()]);
  const tag = cifra.getAuthTag();
  return PREFIXO_PII + Buffer.concat([iv, tag, texto]).toString('base64url');
}

export function decifrarCampo(campo: CampoPii, valor: string): string {
  if (!estaCifrado(valor)) return valor; // texto puro (dado antigo)
  const { enc } = obterChaves();
  const bruto = Buffer.from(valor.slice(PREFIXO_PII.length), 'base64url');
  const iv = bruto.subarray(0, 12);
  const tag = bruto.subarray(12, 28);
  const texto = bruto.subarray(28);
  const decifra = createDecipheriv('aes-256-gcm', enc, iv);
  decifra.setAAD(Buffer.from(campo));
  decifra.setAuthTag(tag);
  return Buffer.concat([decifra.update(texto), decifra.final()]).toString(
    'utf8',
  );
}

function ehObjetoSimples(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Decifra, em qualquer lugar da árvore de resultado do Prisma (inclusive
 * `include` aninhado), os campos cpf/cnh/telefone que estejam cifrados.
 * Muta e devolve o próprio valor.
 */
export function revelarPii<T>(valor: T): T {
  if (Array.isArray(valor)) {
    for (const item of valor) revelarPii(item);
    return valor;
  }
  if (!ehObjetoSimples(valor)) return valor;
  const obj = valor as Record<string, unknown>;
  for (const chave of Object.keys(obj)) {
    const atual = obj[chave];
    if (
      (CAMPOS_PII as readonly string[]).includes(chave) &&
      estaCifrado(atual)
    ) {
      obj[chave] = decifrarCampo(chave as CampoPii, atual);
    } else if (atual !== null && typeof atual === 'object') {
      revelarPii(atual);
    }
  }
  return valor;
}

function cifrarValorDeFiltro(campo: CampoPii, v: unknown): unknown {
  if (typeof v === 'string') return cifrarCampo(campo, v);
  if (Array.isArray(v)) return v.map((x) => cifrarValorDeFiltro(campo, x));
  if (ehObjetoSimples(v)) {
    const saida: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      saida[k] =
        k === 'equals' || k === 'in' || k === 'not' || k === 'notIn'
          ? cifrarValorDeFiltro(campo, x)
          : x;
    }
    return saida;
  }
  return v;
}

/** Cifra os campos pessoais de um filtro `where` (inclui AND/OR/NOT). */
export function cifrarFiltroPii(where: unknown): unknown {
  if (Array.isArray(where)) return where.map(cifrarFiltroPii);
  if (!ehObjetoSimples(where)) return where;
  const saida: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(where)) {
    if (chave === 'AND' || chave === 'OR' || chave === 'NOT') {
      saida[chave] = cifrarFiltroPii(v);
    } else if ((CAMPOS_PII as readonly string[]).includes(chave)) {
      saida[chave] = cifrarValorDeFiltro(chave as CampoPii, v);
    } else {
      saida[chave] = v;
    }
  }
  return saida;
}

/** Cifra cpf/cnh/telefone de um `data` de create/update (aceita `{ set }`). */
export function cifrarDadosPii<T>(data: T): T {
  if (Array.isArray(data)) return data.map(cifrarDadosPii) as unknown as T;
  if (!ehObjetoSimples(data)) return data;
  const saida: Record<string, unknown> = { ...data };
  for (const campo of CAMPOS_PII) {
    const v = saida[campo];
    if (typeof v === 'string') {
      saida[campo] = cifrarCampo(campo, v);
    } else if (ehObjetoSimples(v) && typeof v.set === 'string') {
      saida[campo] = { ...v, set: cifrarCampo(campo, v.set) };
    }
  }
  return saida as T;
}

const OPS_COM_WHERE = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * Prepara os argumentos de uma operação nos modelos com dado pessoal
 * (Motorista, Ajudante): cifra `where` e `data`/`create`/`update`. Só age
 * com PII_ENCRYPTION_ENABLED=true.
 */
export function cifrarArgumentosPii(
  operacao: string,
  args: unknown[],
): unknown[] {
  if (!criptografiaPiiLigada() || !ehObjetoSimples(args[0])) return args;
  const a: Record<string, unknown> = { ...args[0] };
  if (OPS_COM_WHERE.has(operacao) && a.where !== undefined) {
    a.where = cifrarFiltroPii(a.where);
  }
  if (a.data !== undefined) a.data = cifrarDadosPii(a.data);
  if (operacao === 'upsert') {
    if (a.create !== undefined) a.create = cifrarDadosPii(a.create);
    if (a.update !== undefined) a.update = cifrarDadosPii(a.update);
  }
  return [a, ...args.slice(1)];
}

/** Para escritas que NÃO passam pelo proxy do PrismaService (`cru`, `tx`). */
export function protegerDadosPii<T>(data: T): T {
  return criptografiaPiiLigada() ? cifrarDadosPii(data) : data;
}

/**
 * Condição de busca por CPF na lista. Com o CPF cifrado (determinístico) só
 * dá para buscar pelo CPF COMPLETO (11 dígitos); busca parcial exigiria
 * guardar o CPF legível. Enquanto a cifra estiver desligada, mantém a
 * busca parcial de antes.
 */
export function condicaoBuscaCpf(
  termo: string,
): { cpf: { contains: string } } | { cpf: string } | null {
  if (!criptografiaPiiLigada()) return { cpf: { contains: termo } };
  const digitos = termo.replace(/\D/g, '');
  return digitos.length === 11 ? { cpf: digitos } : null;
}
