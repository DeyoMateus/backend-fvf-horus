import { Module } from '@nestjs/common';
import { PushNotificationsModule } from '../common/notifications/push-notifications.module';
import { FolgaConcedidaModule } from '../folga-concedida/folga-concedida.module';
import {
  SolicitacoesFolgaGeralController,
  SolicitacoesFolgaPorMotoristaController,
} from './solicitacoes-folga.controller';
import { SolicitacoesFolgaMobileController } from './solicitacoes-folga-mobile.controller';
import { ExpiracaoSolicitacoesFolgaService } from './expiracao-solicitacoes-folga.service';
import { SolicitacoesFolgaService } from './solicitacoes-folga.service';

@Module({
  imports: [PushNotificationsModule, FolgaConcedidaModule],
  controllers: [
    SolicitacoesFolgaGeralController,
    SolicitacoesFolgaPorMotoristaController,
    SolicitacoesFolgaMobileController,
  ],
  providers: [SolicitacoesFolgaService, ExpiracaoSolicitacoesFolgaService],
  exports: [SolicitacoesFolgaService],
})
export class SolicitacoesFolgaModule {}
