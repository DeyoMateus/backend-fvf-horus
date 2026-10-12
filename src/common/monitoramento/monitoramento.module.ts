import { Module } from '@nestjs/common';
import { PushNotificationsModule } from '../notifications/push-notifications.module';
import { MonitoramentoController } from './monitoramento.controller';
import { MonitoramentoOperacionalService } from './monitoramento-operacional.service';

@Module({
  imports: [PushNotificationsModule],
  controllers: [MonitoramentoController],
  providers: [MonitoramentoOperacionalService],
})
export class MonitoramentoModule {}
