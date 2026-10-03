import type { Request, Response } from 'express';

/**
 * Refresh token deixou de ser devolvido no corpo JSON do login/refresh
 * (o frontend guardava em localStorage, que qualquer XSS consegue ler ,
 * ver auditoria de segurança) e passou a viajar só como cookie
 * `httpOnly`. Sem `cookie-parser`/`@types/cookie` de propósito: a
 * instalação de pacotes novos neste ambiente de dev tem se mostrado
 * instável , o parse manual abaixo é trivial o bastante pra não
 * justificar arriscar isso, e evita depender de tipos de terceiros.
 *
 * `SameSite=None` (só em produção) é necessário porque o frontend
 * (Vercel) e o backend (Hostinger/outro host) vivem em domínios
 * diferentes , sem isso o navegador não anexaria o cookie nas chamadas
 * de API. Isso abre uma superfície de CSRF (qualquer site pode
 * DISPARAR a requisição com o cookie anexado, só não consegue LER a
 * resposta por causa do CORS) , fechada por `exigirRequisicaoDoFrontend`
 * abaixo: exige um header custom que só o próprio frontend envia, e que
 * um <form> ou uma tag <img> de outro site não conseguem forjar; um
 * `fetch` de outro site que tentasse enviar esse header disparia um
 * preflight CORS que o backend já rejeita (a origem não está em
 * CORS_ORIGINS).
 */
const NOME_COOKIE_REFRESH = 'fvf_horus_refresh';
const HEADER_ANTI_CSRF = 'x-fvf-horus-client';

// Rodada 65 , pedido do usuário: sessão do painel do gestor deve durar
// até 5h de INATIVIDADE sem deslogar (ver AuthService.emitirTokens, que
// agora recalcula essa janela a cada login/refresh , uma sessão ativa
// nunca expira, só uma parada por 5h+ sem nenhuma chamada). Por isso
// esta função passou a receber o tempo de vida do cookie já em
// milissegundos (cada chamador decide a unidade certa pro seu próprio
// fluxo) em vez de assumir "dias" , o painel do gestor usa horas, o
// super admin (abaixo) continua em dias.
export function definirCookieRefresh(
  res: Response,
  refreshTokenPlano: string,
  maxAgeMs: number,
): void {
  res.cookie(NOME_COOKIE_REFRESH, refreshTokenPlano, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/auth',
    maxAge: maxAgeMs,
  });
}

export function limparCookieRefresh(res: Response): void {
  res.clearCookie(NOME_COOKIE_REFRESH, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/auth',
  });
}

/** Parse manual, só o suficiente pra ler um cookie pelo nome , ver comentário no topo do arquivo. */
function lerCookiePorNome(
  req: Request,
  nomeCookie: string,
): string | undefined {
  const bruto = req.headers.cookie;
  if (!bruto) return undefined;
  for (const parte of bruto.split(';')) {
    const separador = parte.indexOf('=');
    if (separador === -1) continue;
    const nome = parte.slice(0, separador).trim();
    if (nome === nomeCookie) {
      return decodeURIComponent(parte.slice(separador + 1).trim());
    }
  }
  return undefined;
}

export function lerCookieRefresh(req: Request): string | undefined {
  return lerCookiePorNome(req, NOME_COOKIE_REFRESH);
}

// ===== Super admin (Rodada 31) =====
// Cookie e path completamente separados do refresh de UsuarioEmpresa
// acima , os dois tipos de ator nunca compartilham sessão, e um
// super admin logado no mesmo navegador de um painel de grupo (pouco
// provável na prática, mas não impossível) não deve ter os refresh
// tokens colidindo nem se sobrescrevendo.
const NOME_COOKIE_REFRESH_SUPER_ADMIN = 'fvf_horus_super_admin_refresh';
const PATH_SUPER_ADMIN = '/super-admin/auth';

export function definirCookieRefreshSuperAdmin(
  res: Response,
  refreshTokenPlano: string,
  maxAgeMs: number,
): void {
  res.cookie(NOME_COOKIE_REFRESH_SUPER_ADMIN, refreshTokenPlano, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: PATH_SUPER_ADMIN,
    maxAge: maxAgeMs,
  });
}

export function limparCookieRefreshSuperAdmin(res: Response): void {
  res.clearCookie(NOME_COOKIE_REFRESH_SUPER_ADMIN, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: PATH_SUPER_ADMIN,
  });
}

export function lerCookieRefreshSuperAdmin(req: Request): string | undefined {
  return lerCookiePorNome(req, NOME_COOKIE_REFRESH_SUPER_ADMIN);
}

/**
 * Mitigação de CSRF pros endpoints que dependem do cookie de refresh:
 * exige um header que só o próprio frontend (nosso client axios) envia.
 * Um <form>/<img> de outro site não sabe mandar headers customizados; um
 * `fetch` de outro site que tentasse forjar isso cairia no preflight de
 * CORS, que o backend já rejeita pra origens fora de CORS_ORIGINS.
 */
export function exigirRequisicaoDoFrontend(req: Request): boolean {
  return req.headers[HEADER_ANTI_CSRF] === '1';
}

export { HEADER_ANTI_CSRF };
