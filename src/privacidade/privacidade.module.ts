import { Module } from '@nestjs/common';
import {
  PrivacidadeMobileController,
  PrivacidadePainelController,
  PrivacidadePublicaController,
} from './privacidade.controller';
import { PrivacidadeService } from './privacidade.service';
import { PrivacidadeAvisoPoliticaService } from './privacidade-aviso-politica.service';
import { PushNotificationsModule } from '../common/notifications/push-notifications.module';

@Module({
  imports: [PushNotificationsModule],
  controllers: [
    PrivacidadePublicaController,
    PrivacidadeMobileController,
    PrivacidadePainelController,
  ],
  providers: [PrivacidadeService, PrivacidadeAvisoPoliticaService],
})
export class PrivacidadeModule {}
