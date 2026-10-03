import { Module } from '@nestjs/common';
import { SuperAdminAuthController } from './super-admin-auth.controller';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';

// JwtModule/PassportModule já são globais (ver AuthModule) , não
// precisa importar nada de novo aqui pra usar JwtAuthGuard.
@Module({
  controllers: [SuperAdminAuthController, SuperAdminController],
  providers: [SuperAdminAuthService, SuperAdminService],
})
export class SuperAdminModule {}
