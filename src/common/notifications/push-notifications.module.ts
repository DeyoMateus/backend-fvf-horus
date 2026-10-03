import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PushNotificationsProcessor } from './push-notifications.processor';
import { PushNotificationsService } from './push-notifications.service';
import { FILA_NOTIFICACOES_PUSH } from './push-notifications.constants';
import { WhatsappNotificationsProcessor } from './whatsapp-notifications.processor';
import { WhatsappNotificationsService } from './whatsapp-notifications.service';
import { FILA_NOTIFICACOES_WHATSAPP } from './whatsapp-notifications.constants';

export { FILA_NOTIFICACOES_PUSH };

// A conexão com o Redis (BullModule.forRootAsync) é registrada uma
// única vez no AppModule , aqui só registramos as filas específicas
// desta feature, para não duplicar a conexão se este módulo for
// importado em mais de um lugar (RegistrosJornadaModule, futuros
// consumidores etc.). Push (motorista) e WhatsApp (gestor) moram no
// mesmo módulo porque são as duas "notificações de alerta", ambas
// fail-open e ambas fire-and-forget a partir do mesmo ponto de chamada.
@Module({
  imports: [
    BullModule.registerQueue({ name: FILA_NOTIFICACOES_PUSH }),
    BullModule.registerQueue({ name: FILA_NOTIFICACOES_WHATSAPP }),
  ],
  providers: [
    PushNotificationsService,
    PushNotificationsProcessor,
    WhatsappNotificationsService,
    WhatsappNotificationsProcessor,
  ],
  exports: [PushNotificationsService, WhatsappNotificationsService],
})
export class PushNotificationsModule {}
