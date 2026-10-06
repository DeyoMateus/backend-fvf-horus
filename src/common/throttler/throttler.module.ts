import { Global, Module } from '@nestjs/common';
import { DeviceAuthLimiterService } from './device-auth-limiter.service';
import { RedisThrottlerStorageService } from './redis-throttler-storage.service';

/**
 * Rodada 165: o storage de rate limit (Redis + fallback local) passa a ser
 * um provider único e compartilhado: o ThrottlerModule global e o limitador
 * das rotas de dispositivo usam a MESMA instância (uma só conexão Redis).
 */
@Global()
@Module({
  providers: [RedisThrottlerStorageService, DeviceAuthLimiterService],
  exports: [RedisThrottlerStorageService, DeviceAuthLimiterService],
})
export class AppThrottlerStorageModule {}
