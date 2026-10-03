import { Module } from '@nestjs/common';
import { PushNotificationsModule } from '../common/notifications/push-notifications.module';
import { AutorrelatoFolgaController } from './autorrelato-folga.controller';
import { AutorrelatoFolgaMobileController } from './autorrelato-folga-mobile.controller';
import { AutorrelatoFolgaService } from './autorrelato-folga.service';

@Module({
  imports: [PushNotificationsModule],
  controllers: [AutorrelatoFolgaController, AutorrelatoFolgaMobileController],
  providers: [AutorrelatoFolgaService],
})
export class AutorrelatoFolgaModule {}
