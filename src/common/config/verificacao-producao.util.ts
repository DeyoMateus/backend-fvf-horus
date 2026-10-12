/**
 * Rodada 213: checagem de configuração na subida. Em produção, a ausência de
 * um segredo essencial derruba o boot (falhar alto é melhor que rodar
 * sem segurança); configurações fracas ou opcionais viram aviso no log.
 */
export interface ResultadoVerificacaoProducao {
  erros: string[];
  avisos: string[];
}

export function verificarConfiguracaoDeProducao(
  env: NodeJS.ProcessEnv,
): ResultadoVerificacaoProducao {
  const erros: string[] = [];
  const avisos: string[] = [];
  if (env.NODE_ENV !== 'production') return { erros, avisos };

  if (!env.DATABASE_URL) erros.push('DATABASE_URL ausente.');
  const jwt = env.JWT_ACCESS_SECRET;
  if (!jwt) erros.push('JWT_ACCESS_SECRET ausente.');
  else if (jwt.length < 32)
    avisos.push('JWT_ACCESS_SECRET tem menos de 32 caracteres: use um segredo aleatório longo.');
  if (!env.CRYPTO_MASTER_KEY || !/^[0-9a-fA-F]{64}$/.test(env.CRYPTO_MASTER_KEY))
    erros.push('CRYPTO_MASTER_KEY ausente ou inválida (64 caracteres hex).');

  if (!env.CORS_ORIGINS)
    avisos.push('CORS_ORIGINS vazio: o painel web não conseguirá chamar a API.');
  if (env.PII_ENCRYPTION_ENABLED !== 'true')
    avisos.push('PII_ENCRYPTION_ENABLED não é "true": CPF, CNH e telefone novos estão sendo gravados sem criptografia.');
  if (!env.ALERTA_OPERACIONAL_EMAIL && !env.ALERTA_WEBHOOK_URL)
    avisos.push('Sem ALERTA_OPERACIONAL_EMAIL/ALERTA_WEBHOOK_URL: ninguém será avisado se WhatsApp, Redis ou banco falharem.');
  if (!env.RESEND_API_KEY)
    avisos.push('RESEND_API_KEY ausente: e-mails (recuperação de senha, alertas operacionais) não serão enviados.');
  if (env.EXIGIR_CIENCIA_PRIVACIDADE === 'false')
    avisos.push('EXIGIR_CIENCIA_PRIVACIDADE=false: a exigência de ciência da privacidade está desligada.');
  if (env.CLOUDFLARE_ATIVO === 'true') {
    if (!env.CF_ORIGIN_SECRET || env.CF_ORIGIN_SECRET.length < 24)
      erros.push('CLOUDFLARE_ATIVO=true exige CF_ORIGIN_SECRET com pelo menos 24 caracteres.');
  } else {
    avisos.push('CLOUDFLARE_ATIVO não está ligado: a API está exposta direto, sem proxy/WAF.');
  }
  return { erros, avisos };
}
