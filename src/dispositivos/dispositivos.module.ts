import { Module } from '@nestjs/common';
import { RelogioConfiavelModule } from '../common/relogio-confiavel/relogio-confiavel.module';
import { DispositivosController } from './dispositivos.controller';
import { DispositivosMobileController } from './dispositivos-mobile.controller';
import { SolicitacoesTrocaDispositivoController } from './solicitacoes-troca-dispositivo.controller';
import { DispositivosService } from './dispositivos.service';

@Module({
  imports: [RelogioConfiavelModule],
  controllers: [DispositivosController, DispositivosMobileController, SolicitacoesTrocaDispositivoController],
  providers: [DispositivosService],
  exports: [DispositivosService],
})
export class DispositivosModule {}
