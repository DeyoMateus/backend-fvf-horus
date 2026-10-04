import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { ThrottlerStorage } from '@nestjs/throttler';

/** Mesmo shape de `ThrottlerStorageRecord` (@nestjs/throttler não reexporta esse tipo do índice público do pacote). */
interface RegistroThrottlerStorage {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Storage do rate limiter (`@nestjs/throttler`) backeado por Redis, em vez
 * do Map em memória padrão do pacote.
 *
 * Por quê: o Map em memória só existe dentro de UMA instância do processo
 * Node. No dia em que a plataforma escalar horizontalmente (2+ instâncias
 * do backend atrás de um load balancer, que é justamente a meta de
 * "suportar milhares de requisições simultâneas"), cada instância teria seu
 * próprio contador , um atacante (ou um bug de retry no app mobile)
 * conseguiria N vezes mais requisições que o limite configurado, uma vez
 * por instância. Com o contador no Redis, todas as instâncias compartilham
 * o mesmo estado e o limite vale de fato para a aplicação como um todo.
 *
 * Reimplementa a mesma semântica do `ThrottlerStorageService` original
 * (ver node_modules/@nestjs/throttler/dist/throttler.service.js): uma
 * janela deslizante simples (contador zera quando expira) mais bloqueio
 * temporário (`isBlocked`) quando o limite é excedido dentro da janela.
 * O incremento é atômico via script Lua , evita race condition entre
 * requisições concorrentes lendo/escrevendo o mesmo contador.
 *
 * Fallback em memória (não fail-open puro): se o Redis estiver fora do
 * ar, em vez de simplesmente deixar passar sem limite nenhum, usa um
 * Map local com a MESMA lógica de janela/bloqueio, só que por instância
 * (exatamente o comportamento padrão do pacote antes deste storage
 * existir). Numa queda de Redis isolada, isso ainda impede brute-force
 * de login e afins através da instância que atendeu a requisição , só
 * deixa de ser um limite GLOBAL (compartilhado entre instâncias)
 * enquanto o Redis estiver fora, o que é um degrade aceitável, bem
 * diferente de "nenhum limite" (o que existia antes desta revisão).
 */
@Injectable()
export class RedisThrottlerStorageService
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly logger = new Logger(RedisThrottlerStorageService.name);
  private readonly redis: Redis;

  // Fallback só usado quando a chamada ao Redis falha , ver comentário
  // da classe. Limpeza oportunista: entradas expiradas há mais de 1h são
  // descartadas na hora de gravar uma nova (evita crescimento sem fim
  // caso o Redis fique indisponível por muito tempo).
  private readonly fallbackLocal = new Map<
    string,
    {
      hits: number;
      expiresAt: number;
      isBlocked: boolean;
      blockExpiresAt: number;
    }
  >();

  private static readonly SCRIPT_INCREMENTAR = `
    local key = KEYS[1]
    local ttlMs = tonumber(ARGV[1])
    local limit = tonumber(ARGV[2])
    local blockDurationMs = tonumber(ARGV[3])
    local now = tonumber(ARGV[4])

    local data = redis.call('HMGET', key, 'hits', 'expiresAt', 'isBlocked', 'blockExpiresAt')
    local hits = tonumber(data[1]) or 0
    local expiresAt = tonumber(data[2]) or 0
    local isBlocked = data[3] == '1'
    local blockExpiresAt = tonumber(data[4]) or 0

    if expiresAt <= now then
      expiresAt = now + ttlMs
      hits = 0
    end

    if isBlocked and blockExpiresAt <= now then
      isBlocked = false
      hits = 0
      expiresAt = now + ttlMs
    end

    if not isBlocked then
      hits = hits + 1
    end

    if hits > limit and not isBlocked then
      isBlocked = true
      blockExpiresAt = now + blockDurationMs
    end

    redis.call('HMSET', key, 'hits', hits, 'expiresAt', expiresAt, 'isBlocked', isBlocked and '1' or '0', 'blockExpiresAt', blockExpiresAt)
    local pexpireMs = math.max(expiresAt - now, blockExpiresAt - now, 1000)
    redis.call('PEXPIRE', key, pexpireMs)

    return {hits, expiresAt - now, isBlocked and 1 or 0, math.max(blockExpiresAt - now, 0)}
  `;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      // Mesma conexão lógica do Redis usada pelas filas BullMQ, mas em
      // cliente próprio (evita competir com o BullMQ por comandos
      // bloqueantes e mantém este módulo desacoplado).
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      lazyConnect: false,
    });
    this.redis.on('error', (erro) => {
      this.logger.warn(
        `Redis do rate limiter indisponível , seguindo sem bloquear requisições: ${erro.message}`,
      );
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<RegistroThrottlerStorage> {
    const chaveRedis = `throttler:${throttlerName}:${key}`;
    try {
      const resultado = (await this.redis.eval(
        RedisThrottlerStorageService.SCRIPT_INCREMENTAR,
        1,
        chaveRedis,
        ttl,
        limit,
        blockDuration || ttl,
        Date.now(),
      )) as [number, number, number, number];

      const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] =
        resultado;
      return {
        totalHits,
        timeToExpire: Math.ceil(timeToExpireMs / 1000),
        isBlocked: isBlocked === 1,
        timeToBlockExpire: Math.ceil(timeToBlockExpireMs / 1000),
      };
    } catch (erro) {
      this.logger.warn(
        `Falha ao incrementar contador de rate limit no Redis , usando fallback local: ${(erro as Error).message}`,
      );
      return this.incrementarFallbackLocal(
        chaveRedis,
        ttl,
        limit,
        blockDuration || ttl,
      );
    }
  }

  /** Mesma lógica do script Lua acima, só que num Map local , usado apenas quando o Redis está inacessível. */
  private incrementarFallbackLocal(
    chave: string,
    ttl: number,
    limit: number,
    blockDurationMs: number,
  ): RegistroThrottlerStorage {
    const agora = Date.now();
    const registro = this.fallbackLocal.get(chave) ?? {
      hits: 0,
      expiresAt: 0,
      isBlocked: false,
      blockExpiresAt: 0,
    };

    if (registro.expiresAt <= agora) {
      registro.expiresAt = agora + ttl;
      registro.hits = 0;
    }
    if (registro.isBlocked && registro.blockExpiresAt <= agora) {
      registro.isBlocked = false;
      registro.hits = 0;
      registro.expiresAt = agora + ttl;
    }
    if (!registro.isBlocked) {
      registro.hits += 1;
    }
    if (registro.hits > limit && !registro.isBlocked) {
      registro.isBlocked = true;
      registro.blockExpiresAt = agora + blockDurationMs;
    }

    this.fallbackLocal.set(chave, registro);

    // Limpeza oportunista de entradas antigas (>1h expiradas), pra não
    // crescer sem fim durante uma queda de Redis prolongada.
    if (this.fallbackLocal.size % 500 === 0) {
      for (const [k, v] of this.fallbackLocal) {
        if (Math.max(v.expiresAt, v.blockExpiresAt) < agora - 3_600_000)
          this.fallbackLocal.delete(k);
      }
    }

    return {
      totalHits: registro.hits,
      timeToExpire: Math.ceil((registro.expiresAt - agora) / 1000),
      isBlocked: registro.isBlocked,
      timeToBlockExpire: Math.ceil(
        Math.max(registro.blockExpiresAt - agora, 0) / 1000,
      ),
    };
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}
