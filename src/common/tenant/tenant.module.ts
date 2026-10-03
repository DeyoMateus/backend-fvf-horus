import { Global, Module } from '@nestjs/common';
import { TenantService } from './tenant.service';

// @Global(): usado por praticamente todo controller/service que lida
// com Motorista/DocumentoCarga (ver comentário em TenantService) ,
// registrar globalmente evita ter que importar TenantModule em uma
// dúzia de outros módulos.
@Global()
@Module({
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
