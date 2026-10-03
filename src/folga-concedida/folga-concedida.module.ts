import { Module } from '@nestjs/common';
import { PushNotificationsModule } from '../common/notifications/push-notifications.module';
import { FolgaConcedidaController } from './folga-concedida.controller';
import { FolgaConcedidaMobileController } from './folga-concedida-mobile.controller';
import { FolgaConcedidaService } from './folga-concedida.service';

@Module({
  imports: [PushNotificationsModule],
  controllers: [FolgaConcedidaController, FolgaConcedidaMobileController],
  providers: [FolgaConcedidaService],
  exports: [FolgaConcedidaService],
})
export class FolgaConcedidaModule {}
