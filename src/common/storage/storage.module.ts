import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

// Global porque é um cliente stateless de infraestrutura (como o Prisma) ,
// qualquer módulo que precisar subir/baixar arquivo usa sem precisar
// importar StorageModule explicitamente em cada feature.
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
