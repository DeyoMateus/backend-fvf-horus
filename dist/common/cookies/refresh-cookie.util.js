"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEADER_ANTI_CSRF = void 0;
exports.definirCookieRefresh = definirCookieRefresh;
exports.limparCookieRefresh = limparCookieRefresh;
exports.lerCookieRefresh = lerCookieRefresh;
exports.definirCookieRefreshSuperAdmin = definirCookieRefreshSuperAdmin;
exports.limparCookieRefreshSuperAdmin = limparCookieRefreshSuperAdmin;
exports.lerCookieRefreshSuperAdmin = lerCookieRefreshSuperAdmin;
exports.exigirRequisicaoDoFrontend = exigirRequisicaoDoFrontend;
const NOME_COOKIE_REFRESH = 'fvf_horus_refresh';
const HEADER_ANTI_CSRF = 'x-fvf-horus-client';
exports.HEADER_ANTI_CSRF = HEADER_ANTI_CSRF;
function definirCookieRefresh(res, refreshTokenPlano, maxAgeMs) {
    res.cookie(NOME_COOKIE_REFRESH, refreshTokenPlano, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/auth',
        maxAge: maxAgeMs,
    });
}
function limparCookieRefresh(res) {
    res.clearCookie(NOME_COOKIE_REFRESH, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/auth',
    });
}
function lerCookiePorNome(req, nomeCookie) {
    const bruto = req.headers.cookie;
    if (!bruto)
        return undefined;
    for (const parte of bruto.split(';')) {
        const separador = parte.indexOf('=');
        if (separador === -1)
            continue;
        const nome = parte.slice(0, separador).trim();
        if (nome === nomeCookie) {
            return decodeURIComponent(parte.slice(separador + 1).trim());
        }
    }
    return undefined;
}
function lerCookieRefresh(req) {
    return lerCookiePorNome(req, NOME_COOKIE_REFRESH);
}
const NOME_COOKIE_REFRESH_SUPER_ADMIN = 'fvf_horus_super_admin_refresh';
const PATH_SUPER_ADMIN = '/super-admin/auth';
function definirCookieRefreshSuperAdmin(res, refreshTokenPlano, maxAgeMs) {
    res.cookie(NOME_COOKIE_REFRESH_SUPER_ADMIN, refreshTokenPlano, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: PATH_SUPER_ADMIN,
        maxAge: maxAgeMs,
    });
}
function limparCookieRefreshSuperAdmin(res) {
    res.clearCookie(NOME_COOKIE_REFRESH_SUPER_ADMIN, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: PATH_SUPER_ADMIN,
    });
}
function lerCookieRefreshSuperAdmin(req) {
    return lerCookiePorNome(req, NOME_COOKIE_REFRESH_SUPER_ADMIN);
}
function exigirRequisicaoDoFrontend(req) {
    return req.headers[HEADER_ANTI_CSRF] === '1';
}
//# sourceMappingURL=refresh-cookie.util.js.map