import type { RequestHandler } from 'express';
export declare const CABECALHO_ORIGEM = "x-origin-verify";
export declare function criarMiddlewareCloudflare(env: NodeJS.ProcessEnv): RequestHandler | null;
export declare function semCacheNaApi(): RequestHandler;
