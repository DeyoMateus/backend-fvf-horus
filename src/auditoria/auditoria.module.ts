import { Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller';

// AuditService já é @Global (ver AuditModule) , não precisa importar
// nada aqui além do controller.
@Module({
  controllers: [AuditoriaController],
})
export class AuditoriaModule {}
