import { Module } from '@nestjs/common';
import { PushNotificationsModule } from '../common/notifications/push-notifications.module';
import { StorageModule } from '../common/storage/storage.module';
import { TratamentosPontoModule } from '../tratamentos-ponto/tratamentos-ponto.module';
import {
  SolicitacoesAjustePontoGeralController,
  SolicitacoesAjustePontoPorMotoristaController,
} from './solicitacoes-ajuste-ponto.controller';
import { SolicitacoesAjustePontoMobileController } from './solicitacoes-ajuste-ponto-mobile.controller';
import { SolicitacoesAjustePontoService } from './solicitacoes-ajuste-ponto.service';

@Module({
  imports: [StorageModule, PushNotificationsModule, TratamentosPontoModule],
  controllers: [
    SolicitacoesAjustePontoGeralController,
    SolicitacoesAjustePontoPorMotoristaController,
    SolicitacoesAjustePontoMobileController,
  ],
  providers: [SolicitacoesAjustePontoService],
  exports: [SolicitacoesAjustePontoService],
})
export class SolicitacoesAjustePontoModule {}
