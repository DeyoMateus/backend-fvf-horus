import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { FILA_NOTIFICACOES_PUSH } from './push-notifications.constants';

export interface JobNotificacaoPush {
  pushToken: string;
  titulo: string;
  corpo: string;
  dados?: Record<string, unknown>;
}

/**
 * Produtor da fila de notificações push (Expo Push API). Enfileira em
 * vez de chamar a API do Expo direto na requisição que criou o alerta ,
 * o registro de ponto do motorista nunca deve esperar (ou falhar por
 * causa) de uma notificação.
 *
 * Fail-open: se o Redis estiver fora do ar, loga e segue , notificação
 * é um "nice to have" operacional, nunca pode travar o ponto.
 */
@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    @InjectQueue(FILA_NOTIFICACOES_PUSH)
    private readonly fila: Queue<JobNotificacaoPush>,
    private readonly prisma: PrismaService,
  ) {}

  async notificarMotorista(
    motoristaId: string,
    titulo: string,
    corpo: string,
    dados?: Record<string, unknown>,
  ) {
    try {
      const vinculo = await this.prisma.dispositivoVinculado.findUnique({
        where: { motoristaId },
        select: { pushToken: true },
      });
      if (!vinculo?.pushToken) return; // app não registrou push token ainda (ou nunca vai , não é obrigatório)

      await this.fila.add(
        'enviar',
        { pushToken: vinculo.pushToken, titulo, corpo, dados },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );
    } catch (err) {
      this.logger.error(
        `Falha ao enfileirar notificação push para motorista ${motoristaId}`,
        err as Error,
      );
    }
  }
}
