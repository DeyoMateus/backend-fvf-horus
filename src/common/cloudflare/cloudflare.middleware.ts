import { timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Rodada 214: preparo para rodar atrás da Cloudflare (proxy + WAF).
 *
 * Com a Cloudflare na frente, o IP que chega ao app é o da própria
 * Cloudflare/Traefik, o que quebraria o limite de requisições, o bloqueio
 * por falhas e o IP gravado na auditoria. A Cloudflare informa o IP real no
 * cabeçalho `CF-Connecting-IP`, mas esse cabeçalho só é confiável se a
 * requisição de fato veio da Cloudflare. Por isso a confiança é amarrada a
 * um segredo: a Cloudflare adiciona o cabeçalho `X-Origin-Verify: <segredo>`
 * (Transform Rule) e este middleware:
 *   1) recusa (403) qualquer requisição sem o segredo, para ninguém
 *      contornar o WAF acessando o servidor direto pelo IP/domínio do
 *      Easypanel (exceto o `/health` interno, usado pelo próprio Easypanel);
 *   2) só então usa `CF-Connecting-IP` como IP do cliente (`req.ip`).
 *
 * Variáveis:
 *   CLOUDFLARE_ATIVO=true    liga o comportamento acima
 *   CF_ORIGIN_SECRET=<longo> segredo compartilhado (mínimo 24 caracteres)
 * Sem CLOUDFLARE_ATIVO nada muda (comportamento de antes).
 */
export const CABECALHO_ORIGEM = 'x-origin-verify';
const ROTAS_LIVRES_SEM_SEGREDO = new Set(['/health']);

function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export function criarMiddlewareCloudflare(
  env: NodeJS.ProcessEnv,
): RequestHandler | null {
  if (env.CLOUDFLARE_ATIVO !== 'true') return null;
  const segredo = env.CF_ORIGIN_SECRET ?? '';
  if (segredo.length < 24) {
    throw new Error(
      'CLOUDFLARE_ATIVO=true exige CF_ORIGIN_SECRET com pelo menos 24 caracteres.',
    );
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const caminho = req.path;
    const enviado = primeiro(req.headers[CABECALHO_ORIGEM]) ?? '';
    const verificado = enviado.length > 0 && iguais(enviado, segredo);

    if (!verificado) {
      if (ROTAS_LIVRES_SEM_SEGREDO.has(caminho)) return next();
      res.status(403).json({ statusCode: 403, message: 'Acesso direto não permitido.' });
      return;
    }

    const ipCliente = primeiro(req.headers['cf-connecting-ip'])?.trim();
    if (ipCliente && isIP(ipCliente) !== 0) {
      // `req.ip` é um getter do Express; sobrescrever na instância basta
      // para @Ip(), o limitador de requisições e a auditoria.
      Object.defineProperty(req, 'ip', {
        value: ipCliente,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
}

/** Respostas da API nunca devem ser guardadas em cache (nem pela Cloudflare nem por navegadores). */
export function semCacheNaApi(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
}
