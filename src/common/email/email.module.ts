import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

// Global pelo mesmo motivo do StorageModule: cliente stateless de
// infraestrutura, usado por mais de um módulo de auth (tenant e super
// admin) sem precisar importar EmailModule em cada um.
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
