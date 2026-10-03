import { Global, Module } from '@nestjs/common';
import { AccountLockoutService } from './account-lockout.service';

// Global pelo mesmo motivo de EmailModule/StorageModule: cliente
// stateless de infraestrutura, usado por AuthService e
// SuperAdminAuthService (Rodada 35).
@Global()
@Module({
  providers: [AccountLockoutService],
  exports: [AccountLockoutService],
})
export class AccountLockoutModule {}
