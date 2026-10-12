import { verificarConfiguracaoDeProducao } from './verificacao-producao.util';

describe('verificarConfiguracaoDeProducao', () => {
  it('não exige nada fora de produção', () => {
    expect(verificarConfiguracaoDeProducao({ NODE_ENV: 'development' } as never)).toEqual({ erros: [], avisos: [] });
  });

  it('em produção, falta de segredo essencial é erro', () => {
    const r = verificarConfiguracaoDeProducao({ NODE_ENV: 'production' } as never);
    expect(r.erros.join(' ')).toContain('DATABASE_URL');
    expect(r.erros.join(' ')).toContain('JWT_ACCESS_SECRET');
    expect(r.erros.join(' ')).toContain('CRYPTO_MASTER_KEY');
  });

  it('configuração completa não gera erros e opcionais ausentes viram aviso', () => {
    const r = verificarConfiguracaoDeProducao({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://x',
      JWT_ACCESS_SECRET: 'a'.repeat(40),
      CRYPTO_MASTER_KEY: 'ab'.repeat(32),
      CORS_ORIGINS: 'https://painel.exemplo.com',
    } as never);
    expect(r.erros).toEqual([]);
    expect(r.avisos.join(' ')).toContain('PII_ENCRYPTION_ENABLED');
    expect(r.avisos.join(' ')).toContain('ALERTA_OPERACIONAL_EMAIL');
  });
});
