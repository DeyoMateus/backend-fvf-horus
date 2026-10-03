import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * Bloqueio de conta por tentativas de login falhas (Rodada 35) ,
 * complementa, não substitui, o rate limit por IP (`@Throttle` em
 * `/auth/login` e `/super-admin/auth/login`, 5 tentativas/minuto).
 *
 * Por que os dois são necessários: o rate limit por IP não pega um
 * ataque de credential stuffing/brute force distribuído (o atacante
 * rotaciona IP a cada tentativa, ou testa muitas contas diferentes a
 * partir do mesmo IP devagar o bastante pra nunca estourar o limite
 * por IP). Este serviço conta as falhas POR CONTA (chave = e-mail),
 * não por IP , depois de `LIMITE_TENTATIVAS` falhas consecutivas
 * (sucesso zera o contador), a conta fica temporariamente bloqueada
 * por `DURACAO_BLOQUEIO_SEGUNDOS`, não importa de qual IP venha a
 * próxima tentativa.
 *
 * Guardado no Redis (mesma instância lógica do rate limiter , ver
 * `RedisThrottlerStorageService`), com fallback em memória local se o
 * Redis estiver fora do ar (mesmo padrão de degrade aceitável já
 * usado lá: perde o compartilhamento entre instâncias, não perde a
 * proteção). Chave por e-mail, nunca por ID de usuário , o bloqueio
 * precisa acontecer ANTES de saber se o e-mail existe, pro próprio
 * bloqueio não virar um jeito de descobrir se uma conta existe
 * (timing/comportamento diferente já seria um vazamento).
 */
@Injectable()
export class AccountLockoutService implements OnModuleDestroy {
  private readonly logger = new Logger(AccountLockoutService.name);
  private readonly redis: Redis;

  private static readonly LIMITE_TENTATIVAS = 5;
  private static readonly DURACAO_BLOQUEIO_SEGUNDOS = 15 * 60; // 15 min
  private static readonly JANELA_CONTAGEM_SEGUNDOS = 15 * 60; // reseta sozinho se ficar 15min sem nova falha

  private readonly fallbackLocal = new Map<
    string,
    { falhas: number; expiraContagemEm: number; bloqueadoAte: number }
  >();

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      lazyConnect: false,
    });
    this.redis.on('error', (erro) => {
      this.logger.warn(
        `Redis do bloqueio de conta indisponível , usando fallback local: ${erro.message}`,
      );
    });
  }

  private chave(namespace: string, email: string): string {
    // Namespace separa o contador do painel do contador do super
    // admin , mesmo e-mail nunca deveria colidir entre os dois, mas
    // não custa nada garantir.
    return `account-lockout:${namespace}:${email.toLowerCase().trim()}`;
  }

  /** Segundos restantes de bloqueio, ou 0 se a conta não está bloqueada agora. */
  async segundosBloqueados(namespace: string, email: string): Promise<number> {
    const chave = this.chave(namespace, email);
    try {
      const bloqueadoAteStr = await this.redis.hget(chave, 'bloqueadoAte');
      const bloqueadoAte = Number(bloqueadoAteStr ?? 0);
      const restante = Math.ceil((bloqueadoAte - Date.now()) / 1000);
      return Math.max(restante, 0);
    } catch {
      const entrada = this.fallbackLocal.get(chave);
      if (!entrada) return 0;
      return Math.max(Math.ceil((entrada.bloqueadoAte - Date.now()) / 1000), 0);
    }
  }

  /** Registra uma tentativa falha. Bloqueia a conta se atingir o limite. */
  async registrarFalha(namespace: string, email: string): Promise<void> {
    const chave = this.chave(namespace, email);
    const agora = Date.now();
    try {
      const janelaMs = AccountLockoutService.JANELA_CONTAGEM_SEGUNDOS * 1000;
      const dados = await this.redis.hmget(chave, 'falhas', 'expiraContagemEm');
      let falhas = Number(dados[0] ?? 0);
      const expiraContagemEm = Number(dados[1] ?? 0);

      if (expiraContagemEm <= agora) falhas = 0; // janela anterior expirou , recomeça a contagem
      falhas += 1;

      const dadosParaGravar: Record<string, number> = {
        falhas,
        expiraContagemEm: agora + janelaMs,
      };
      if (falhas >= AccountLockoutService.LIMITE_TENTATIVAS) {
        dadosParaGravar.bloqueadoAte =
          agora + AccountLockoutService.DURACAO_BLOQUEIO_SEGUNDOS * 1000;
      }

      await this.redis.hmset(chave, dadosParaGravar as any);
      await this.redis.pexpire(
        chave,
        Math.max(
          janelaMs,
          AccountLockoutService.DURACAO_BLOQUEIO_SEGUNDOS * 1000,
        ),
      );
    } catch {
      const entrada = this.fallbackLocal.get(chave) ?? {
        falhas: 0,
        expiraContagemEm: 0,
        bloqueadoAte: 0,
      };
      if (entrada.expiraContagemEm <= agora) entrada.falhas = 0;
      entrada.falhas += 1;
      entrada.expiraContagemEm =
        agora + AccountLockoutService.JANELA_CONTAGEM_SEGUNDOS * 1000;
      if (entrada.falhas >= AccountLockoutService.LIMITE_TENTATIVAS) {
        entrada.bloqueadoAte =
          agora + AccountLockoutService.DURACAO_BLOQUEIO_SEGUNDOS * 1000;
      }
      this.fallbackLocal.set(chave, entrada);
    }
  }

  /** Chamado em todo login com sucesso , zera o contador de falhas da conta. */
  async registrarSucesso(namespace: string, email: string): Promise<void> {
    const chave = this.chave(namespace, email);
    try {
      await this.redis.del(chave);
    } catch {
      this.fallbackLocal.delete(chave);
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
