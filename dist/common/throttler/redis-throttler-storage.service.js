"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RedisThrottlerStorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisThrottlerStorageService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
let RedisThrottlerStorageService = class RedisThrottlerStorageService {
    static { RedisThrottlerStorageService_1 = this; }
    logger = new common_1.Logger(RedisThrottlerStorageService_1.name);
    redis;
    fallbackLocal = new Map();
    static SCRIPT_INCREMENTAR = `
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
        this.redis = new ioredis_1.Redis({
            host: process.env.REDIS_HOST ?? 'localhost',
            port: Number(process.env.REDIS_PORT ?? 6379),
            maxRetriesPerRequest: 1,
            retryStrategy: (times) => Math.min(times * 200, 2000),
            lazyConnect: false,
        });
        this.redis.on('error', (erro) => {
            this.logger.warn(`Redis do rate limiter indisponível , seguindo sem bloquear requisições: ${erro.message}`);
        });
    }
    async increment(key, ttl, limit, blockDuration, throttlerName) {
        const chaveRedis = `throttler:${throttlerName}:${key}`;
        try {
            const resultado = (await this.redis.eval(RedisThrottlerStorageService_1.SCRIPT_INCREMENTAR, 1, chaveRedis, ttl, limit, blockDuration || ttl, Date.now()));
            const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] = resultado;
            return {
                totalHits,
                timeToExpire: Math.ceil(timeToExpireMs / 1000),
                isBlocked: isBlocked === 1,
                timeToBlockExpire: Math.ceil(timeToBlockExpireMs / 1000),
            };
        }
        catch (erro) {
            this.logger.warn(`Falha ao incrementar contador de rate limit no Redis , usando fallback local: ${erro.message}`);
            return this.incrementarFallbackLocal(chaveRedis, ttl, limit, blockDuration || ttl);
        }
    }
    incrementarFallbackLocal(chave, ttl, limit, blockDurationMs) {
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
            timeToBlockExpire: Math.ceil(Math.max(registro.blockExpiresAt - agora, 0) / 1000),
        };
    }
    async onModuleDestroy() {
        await this.redis.quit().catch(() => undefined);
    }
};
exports.RedisThrottlerStorageService = RedisThrottlerStorageService;
exports.RedisThrottlerStorageService = RedisThrottlerStorageService = RedisThrottlerStorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RedisThrottlerStorageService);
//# sourceMappingURL=redis-throttler-storage.service.js.map