import { OnModuleDestroy } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
interface RegistroThrottlerStorage {
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
}
export declare class RedisThrottlerStorageService implements ThrottlerStorage, OnModuleDestroy {
    private readonly logger;
    private readonly redis;
    private readonly fallbackLocal;
    private static readonly SCRIPT_INCREMENTAR;
    constructor();
    increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<RegistroThrottlerStorage>;
    private incrementarFallbackLocal;
    segundosBloqueado(key: string, throttlerName: string): Promise<number>;
    onModuleDestroy(): Promise<void>;
}
export {};
