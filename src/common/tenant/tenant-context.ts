import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Valor-sentinela usado APENAS pelos poucos pontos do backend que
 * legitimamente cruzam vários grupos de propósito: a varredura de
 * segurança periódica (Rodada 19/20), o processor da fila de
 * verificação agendada (Rodada 21), o seed script, e trechos do
 * `AuthService`/fluxo de troca de dispositivo que ainda não sabem a
 * qual grupo o usuário/motorista pertence (ex.: procurar o usuário
 * pelo e-mail no login). Nunca deve vir de uma requisição HTTP comum ,
 * ver TenantContextInterceptor. É a ÚNICA forma de contornar o Row-Level
 * Security do Postgres (ver migration `..._row_level_security`).
 */
export const SISTEMA = '__sistema__';

interface ContextoTenant {
  grupoId: string;
}

const armazenamento = new AsyncLocalStorage<ContextoTenant>();

/**
 * Contexto de "qual grupo (tenant) está fazendo esta chamada ao banco",
 * lido pelo `PrismaService` (ver prisma.service.ts) antes de qualquer
 * operação num modelo protegido por RLS, pra setar `app.grupo_atual` na
 * transação/conexão certa. Ver claude/arquitetura-seguranca-controle-jornada.md,
 * Rodada 23.
 */
export const TenantContext = {
  /** Roda `fn` com o grupo real (uuid) de quem está fazendo a requisição. */
  paraGrupo<T>(grupoId: string, fn: () => T): T {
    return armazenamento.run({ grupoId }, fn);
  },

  /**
   * Roda `fn` como SISTEMA , sem restrição de tenant. Usar só nos
   * pontos documentados acima, nunca dentro do caminho normal de uma
   * requisição autenticada.
   */
  paraSistema<T>(fn: () => T): T {
    return armazenamento.run({ grupoId: SISTEMA }, fn);
  },

  /** Contexto ativo agora, ou `undefined` se nenhum foi estabelecido. */
  atual(): ContextoTenant | undefined {
    return armazenamento.getStore();
  },
};
