"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAMPOS_PII = exports.PREFIXO_PII = void 0;
exports.reiniciarChavesPii = reiniciarChavesPii;
exports.criptografiaPiiLigada = criptografiaPiiLigada;
exports.estaCifrado = estaCifrado;
exports.cifrarCampo = cifrarCampo;
exports.decifrarCampo = decifrarCampo;
exports.revelarPii = revelarPii;
exports.cifrarFiltroPii = cifrarFiltroPii;
exports.cifrarDadosPii = cifrarDadosPii;
exports.cifrarArgumentosPii = cifrarArgumentosPii;
exports.protegerDadosPii = protegerDadosPii;
exports.condicaoBuscaCpf = condicaoBuscaCpf;
const crypto_1 = require("crypto");
exports.PREFIXO_PII = 'enc:v1:';
exports.CAMPOS_PII = ['cpf', 'cnh', 'telefone'];
let chaves = null;
function obterChaves() {
    if (chaves)
        return chaves;
    const hex = process.env.CRYPTO_MASTER_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error('CRYPTO_MASTER_KEY ausente ou inválida: necessária para a criptografia de CPF/CNH/telefone.');
    }
    const mestre = Buffer.from(hex, 'hex');
    const derivar = (info) => Buffer.from((0, crypto_1.hkdfSync)('sha256', mestre, Buffer.alloc(0), info, 32));
    chaves = { enc: derivar('pii-campo-enc-v1'), iv: derivar('pii-campo-iv-v1') };
    return chaves;
}
function reiniciarChavesPii() {
    chaves = null;
}
function criptografiaPiiLigada() {
    return process.env.PII_ENCRYPTION_ENABLED === 'true';
}
function estaCifrado(valor) {
    return typeof valor === 'string' && valor.startsWith(exports.PREFIXO_PII);
}
function cifrarCampo(campo, valor) {
    if (estaCifrado(valor))
        return valor;
    const { enc, iv: chaveIv } = obterChaves();
    const iv = (0, crypto_1.createHmac)('sha256', chaveIv)
        .update(`${campo}\u0000${valor}`)
        .digest()
        .subarray(0, 12);
    const cifra = (0, crypto_1.createCipheriv)('aes-256-gcm', enc, iv);
    cifra.setAAD(Buffer.from(campo));
    const texto = Buffer.concat([cifra.update(valor, 'utf8'), cifra.final()]);
    const tag = cifra.getAuthTag();
    return exports.PREFIXO_PII + Buffer.concat([iv, tag, texto]).toString('base64url');
}
function decifrarCampo(campo, valor) {
    if (!estaCifrado(valor))
        return valor;
    const { enc } = obterChaves();
    const bruto = Buffer.from(valor.slice(exports.PREFIXO_PII.length), 'base64url');
    const iv = bruto.subarray(0, 12);
    const tag = bruto.subarray(12, 28);
    const texto = bruto.subarray(28);
    const decifra = (0, crypto_1.createDecipheriv)('aes-256-gcm', enc, iv);
    decifra.setAAD(Buffer.from(campo));
    decifra.setAuthTag(tag);
    return Buffer.concat([decifra.update(texto), decifra.final()]).toString('utf8');
}
function ehObjetoSimples(v) {
    if (v === null || typeof v !== 'object')
        return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
}
function revelarPii(valor) {
    if (Array.isArray(valor)) {
        for (const item of valor)
            revelarPii(item);
        return valor;
    }
    if (!ehObjetoSimples(valor))
        return valor;
    const obj = valor;
    for (const chave of Object.keys(obj)) {
        const atual = obj[chave];
        if (exports.CAMPOS_PII.includes(chave) &&
            estaCifrado(atual)) {
            obj[chave] = decifrarCampo(chave, atual);
        }
        else if (atual !== null && typeof atual === 'object') {
            revelarPii(atual);
        }
    }
    return valor;
}
function cifrarValorDeFiltro(campo, v) {
    if (typeof v === 'string')
        return cifrarCampo(campo, v);
    if (Array.isArray(v))
        return v.map((x) => cifrarValorDeFiltro(campo, x));
    if (ehObjetoSimples(v)) {
        const saida = {};
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
function cifrarFiltroPii(where) {
    if (Array.isArray(where))
        return where.map(cifrarFiltroPii);
    if (!ehObjetoSimples(where))
        return where;
    const saida = {};
    for (const [chave, v] of Object.entries(where)) {
        if (chave === 'AND' || chave === 'OR' || chave === 'NOT') {
            saida[chave] = cifrarFiltroPii(v);
        }
        else if (exports.CAMPOS_PII.includes(chave)) {
            saida[chave] = cifrarValorDeFiltro(chave, v);
        }
        else {
            saida[chave] = v;
        }
    }
    return saida;
}
function cifrarDadosPii(data) {
    if (Array.isArray(data))
        return data.map(cifrarDadosPii);
    if (!ehObjetoSimples(data))
        return data;
    const saida = { ...data };
    for (const campo of exports.CAMPOS_PII) {
        const v = saida[campo];
        if (typeof v === 'string') {
            saida[campo] = cifrarCampo(campo, v);
        }
        else if (ehObjetoSimples(v) && typeof v.set === 'string') {
            saida[campo] = { ...v, set: cifrarCampo(campo, v.set) };
        }
    }
    return saida;
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
function cifrarArgumentosPii(operacao, args) {
    if (!criptografiaPiiLigada() || !ehObjetoSimples(args[0]))
        return args;
    const a = { ...args[0] };
    if (OPS_COM_WHERE.has(operacao) && a.where !== undefined) {
        a.where = cifrarFiltroPii(a.where);
    }
    if (a.data !== undefined)
        a.data = cifrarDadosPii(a.data);
    if (operacao === 'upsert') {
        if (a.create !== undefined)
            a.create = cifrarDadosPii(a.create);
        if (a.update !== undefined)
            a.update = cifrarDadosPii(a.update);
    }
    return [a, ...args.slice(1)];
}
function protegerDadosPii(data) {
    return criptografiaPiiLigada() ? cifrarDadosPii(data) : data;
}
function condicaoBuscaCpf(termo) {
    if (!criptografiaPiiLigada())
        return { cpf: { contains: termo } };
    const digitos = termo.replace(/\D/g, '');
    return digitos.length === 11 ? { cpf: digitos } : null;
}
//# sourceMappingURL=pii-campo.util.js.map