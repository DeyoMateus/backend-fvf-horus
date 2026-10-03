import { Module } from '@nestjs/common';
import { FeriadosModule } from '../feriados/feriados.module';
import { RepPModule } from '../common/rep-p/rep-p.module';
import { RegistrosJornadaModule } from '../registros-jornada/registros-jornada.module';
import { FechamentoFiscalController } from './fechamento-fiscal.controller';
import { FechamentoFiscalService } from './fechamento-fiscal.service';

@Module({
  imports: [FeriadosModule, RepPModule, RegistrosJornadaModule],
  controllers: [FechamentoFiscalController],
  providers: [FechamentoFiscalService],
})
export class FechamentoFiscalModule {}
