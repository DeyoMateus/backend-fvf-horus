import { Global, Module } from '@nestjs/common';
import { AbuseGuardService } from './abuse-guard.service';
import { DeviceAuthLimiterService } from './device-auth-limiter.service';
import { RedisThrottlerStorageService } from './redis-throttler-storage.service';

/**
 * Rodada 165: o storage de rate limit (Redis + fallback local) passa a ser
 * um provider único e compartilhado: o ThrottlerModule global e o limitador
 * das rotas de dispositivo usam a MESMA instância (uma só conexão Redis).
 */
@Global()
@Module({
  providers: [
    RedisThrottlerStorageService,
    DeviceAuthLimiterService,
    AbuseGuardService,
  ],
  exports: [
    RedisThrottlerStorageService,
    DeviceAuthLimiterService,
    AbuseGuardService,
  ],
})
export class AppThrottlerStorageModule {}
