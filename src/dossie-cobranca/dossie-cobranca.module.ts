import { Module } from '@nestjs/common';
import { DossieCobrancaController } from './dossie-cobranca.controller';
import { DossieCobrancaService } from './dossie-cobranca.service';

@Module({
  controllers: [DossieCobrancaController],
  providers: [DossieCobrancaService],
})
export class DossieCobrancaModule {}
