import { Global, Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';

// Global pelo mesmo motivo do StorageModule: cliente stateless de
// infraestrutura, qualquer módulo usa sem precisar importar explicitamente.
@Global()
@Module({
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
