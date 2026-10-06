"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashChaveDispositivo = hashChaveDispositivo;
exports.conferirChaveDispositivo = conferirChaveDispositivo;
const crypto_1 = require("crypto");
const PREFIXO_V2 = 'v2:';
let pepperCache = null;
function obterPepper() {
    if (pepperCache)
        return pepperCache;
    const explicito = process.env.DEVICE_KEY_PEPPER;
    if (explicito && explicito.length >= 32) {
        pepperCache = Buffer.from(explicito, 'utf8');
        return pepperCache;
    }
    const mestra = process.env.CRYPTO_MASTER_KEY;
    if (!mestra || mestra.length < 32) {
        throw new Error('DEVICE_KEY_PEPPER (ou CRYPTO_MASTER_KEY) ausente: não é possível calcular o hash da chave do dispositivo.');
    }
    pepperCache = Buffer.from((0, crypto_1.hkdfSync)('sha256', Buffer.from(mestra, 'hex'), Buffer.alloc(0), 'fvf-horus/device-key-pepper/v1', 32));
    return pepperCache;
}
function hashChaveDispositivo(chavePlana) {
    return (PREFIXO_V2 +
        (0, crypto_1.createHmac)('sha256', obterPepper()).update(chavePlana).digest('hex'));
}
function conferirChaveDispositivo(chavePlana, armazenado) {
    if (armazenado.startsWith(PREFIXO_V2)) {
        const esperado = Buffer.from(armazenado.slice(PREFIXO_V2.length), 'hex');
        const recebido = (0, crypto_1.createHmac)('sha256', obterPepper())
            .update(chavePlana)
            .digest();
        return {
            ok: esperado.length === recebido.length &&
                (0, crypto_1.timingSafeEqual)(recebido, esperado),
            precisaMigrar: false,
        };
    }
    const antigo = Buffer.from(armazenado, 'hex');
    const recebido = (0, crypto_1.createHash)('sha256').update(chavePlana).digest();
    const ok = antigo.length === recebido.length && (0, crypto_1.timingSafeEqual)(recebido, antigo);
    return { ok, precisaMigrar: ok };
}
//# sourceMappingURL=device-key-hash.util.js.map