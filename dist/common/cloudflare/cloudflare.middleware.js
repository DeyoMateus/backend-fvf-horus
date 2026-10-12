"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CABECALHO_ORIGEM = void 0;
exports.criarMiddlewareCloudflare = criarMiddlewareCloudflare;
exports.semCacheNaApi = semCacheNaApi;
const crypto_1 = require("crypto");
const net_1 = require("net");
exports.CABECALHO_ORIGEM = 'x-origin-verify';
const ROTAS_LIVRES_SEM_SEGREDO = new Set(['/health']);
function iguais(a, b) {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && (0, crypto_1.timingSafeEqual)(ba, bb);
}
function primeiro(valor) {
    return Array.isArray(valor) ? valor[0] : valor;
}
function criarMiddlewareCloudflare(env) {
    if (env.CLOUDFLARE_ATIVO !== 'true')
        return null;
    const segredo = env.CF_ORIGIN_SECRET ?? '';
    if (segredo.length < 24) {
        throw new Error('CLOUDFLARE_ATIVO=true exige CF_ORIGIN_SECRET com pelo menos 24 caracteres.');
    }
    return (req, res, next) => {
        const caminho = req.path;
        const enviado = primeiro(req.headers[exports.CABECALHO_ORIGEM]) ?? '';
        const verificado = enviado.length > 0 && iguais(enviado, segredo);
        if (!verificado) {
            if (ROTAS_LIVRES_SEM_SEGREDO.has(caminho))
                return next();
            res.status(403).json({ statusCode: 403, message: 'Acesso direto não permitido.' });
            return;
        }
        const ipCliente = primeiro(req.headers['cf-connecting-ip'])?.trim();
        if (ipCliente && (0, net_1.isIP)(ipCliente) !== 0) {
            Object.defineProperty(req, 'ip', {
                value: ipCliente,
                configurable: true,
                enumerable: true,
            });
        }
        next();
    };
}
function semCacheNaApi() {
    return (_req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
    };
}
//# sourceMappingURL=cloudflare.middleware.js.map