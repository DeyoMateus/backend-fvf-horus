import { jest } from '@test/jest-globals';
import { criarMiddlewareCloudflare } from './cloudflare.middleware';

const SEGREDO = 's'.repeat(32);

function executar(
  mw: NonNullable<ReturnType<typeof criarMiddlewareCloudflare>>,
  caminho: string,
  headers: Record<string, string>,
) {
  const req = { path: caminho, headers, ip: '10.0.0.1' } as never;
  const res = {
    statusCode: 0,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    json: jest.fn(),
  };
  const next = jest.fn();
  mw(req, res as never, next);
  return { req: req as { ip: string }, res, next };
}

describe('criarMiddlewareCloudflare', () => {
  it('desligado por padrão', () => {
    expect(criarMiddlewareCloudflare({} as never)).toBeNull();
  });

  it('exige segredo longo quando ligado', () => {
    expect(() =>
      criarMiddlewareCloudflare({ CLOUDFLARE_ATIVO: 'true', CF_ORIGIN_SECRET: 'curto' } as never),
    ).toThrow();
  });

  const mw = criarMiddlewareCloudflare({
    CLOUDFLARE_ATIVO: 'true',
    CF_ORIGIN_SECRET: SEGREDO,
  } as never)!;

  it('bloqueia acesso direto sem o segredo', () => {
    const r = executar(mw, '/auth/login', { 'cf-connecting-ip': '203.0.113.9' });
    expect(r.res.statusCode).toBe(403);
    expect(r.next).not.toHaveBeenCalled();
  });

  it('bloqueia segredo errado', () => {
    const r = executar(mw, '/auth/login', { 'x-origin-verify': 'x'.repeat(32) });
    expect(r.res.statusCode).toBe(403);
  });

  it('libera /health interno sem segredo, mas não confia em CF-Connecting-IP', () => {
    const r = executar(mw, '/health', { 'cf-connecting-ip': '203.0.113.9' });
    expect(r.next).toHaveBeenCalled();
    expect(r.req.ip).toBe('10.0.0.1');
  });

  it('com segredo certo usa o IP real do CF-Connecting-IP', () => {
    const r = executar(mw, '/auth/login', {
      'x-origin-verify': SEGREDO,
      'cf-connecting-ip': '203.0.113.9',
    });
    expect(r.next).toHaveBeenCalled();
    expect(r.req.ip).toBe('203.0.113.9');
  });

  it('ignora CF-Connecting-IP inválido', () => {
    const r = executar(mw, '/x', { 'x-origin-verify': SEGREDO, 'cf-connecting-ip': 'lixo' });
    expect(r.req.ip).toBe('10.0.0.1');
  });
});
