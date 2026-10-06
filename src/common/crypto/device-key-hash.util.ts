import { createHash, createHmac, hkdfSync, timingSafeEqual } from 'crypto';

/**
 * Rodada 165: hash da chave do dispositivo (X-Device-Key) com HMAC-SHA256
 * e "pepper" do servidor, em vez de SHA-256 puro sem segredo.
 *
 * Formato gravado: `v2:<hex>`. Valores antigos (64 hex, sem prefixo) são
 * SHA-256 simples e continuam sendo aceitos; o guard os regrava no
 * formato novo no primeiro acesso válido (migração transparente, sem
 * obrigar o motorista a vincular o aparelho de novo).
 *
 * Pepper: `DEVICE_KEY_PEPPER` (recomendado, 32+ bytes aleatórios em hex ou
 * texto). Se ausente, é derivado por HKDF a partir de `CRYPTO_MASTER_KEY`
 * (contexto próprio, nunca reaproveita a chave crua). Trocar o pepper
 * invalida as chaves já emitidas (os aparelhos precisariam ser
 * vinculados de novo), então ele deve ser estável.
 */
const PREFIXO_V2 = 'v2:';
let pepperCache: Buffer | null = null;

function obterPepper(): Buffer {
  if (pepperCache) return pepperCache;
  const explicito = process.env.DEVICE_KEY_PEPPER;
  if (explicito && explicito.length >= 32) {
    pepperCache = Buffer.from(explicito, 'utf8');
    return pepperCache;
  }
  const mestra = process.env.CRYPTO_MASTER_KEY;
  if (!mestra || mestra.length < 32) {
    throw new Error(
      'DEVICE_KEY_PEPPER (ou CRYPTO_MASTER_KEY) ausente: não é possível calcular o hash da chave do dispositivo.',
    );
  }
  pepperCache = Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(mestra, 'hex'),
      Buffer.alloc(0),
      'fvf-horus/device-key-pepper/v1',
      32,
    ),
  );
  return pepperCache;
}

/** Hash novo (HMAC-SHA256 com pepper) já no formato gravado no banco. */
export function hashChaveDispositivo(chavePlana: string): string {
  return (
    PREFIXO_V2 +
    createHmac('sha256', obterPepper()).update(chavePlana).digest('hex')
  );
}

/**
 * Confere a chave recebida contra o valor gravado, em tempo constante.
 * `precisaMigrar` = o valor gravado ainda é o SHA-256 antigo.
 */
export function conferirChaveDispositivo(
  chavePlana: string,
  armazenado: string,
): { ok: boolean; precisaMigrar: boolean } {
  if (armazenado.startsWith(PREFIXO_V2)) {
    const esperado = Buffer.from(armazenado.slice(PREFIXO_V2.length), 'hex');
    const recebido = createHmac('sha256', obterPepper())
      .update(chavePlana)
      .digest();
    return {
      ok:
        esperado.length === recebido.length &&
        timingSafeEqual(recebido, esperado),
      precisaMigrar: false,
    };
  }
  const antigo = Buffer.from(armazenado, 'hex');
  const recebido = createHash('sha256').update(chavePlana).digest();
  const ok =
    antigo.length === recebido.length && timingSafeEqual(recebido, antigo);
  return { ok, precisaMigrar: ok };
}
