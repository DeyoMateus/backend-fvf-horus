import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FILA_NOTIFICACOES_PUSH } from './push-notifications.constants';
import type { JobNotificacaoPush } from './push-notifications.service';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Consome a fila e chama a Expo Push API (gratuita, não precisa de
 * credencial de app store nem certificado próprio , é o mesmo serviço
 * que o Expo Go e apps standalone usam para push no Android e iOS).
 */
@Processor(FILA_NOTIFICACOES_PUSH)
export class PushNotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(PushNotificationsProcessor.name);

  async process(job: Job<JobNotificacaoPush>): Promise<void> {
    const { pushToken, titulo, corpo, dados } = job.data;

    const resposta = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title: titulo,
        body: corpo,
        data: dados ?? {},
        priority: 'high',
        sound: 'default',
        // Canal Android com som/vibração/importância máxima (criado pelo app,
        // mobile/src/notifications/canalAlertas.ts). Sem isto o push cai no
        // canal padrão, que pode ser silencioso e sem banner.
        channelId: 'alertas-jornada-v2',
      }),
    });

    if (!resposta.ok) {
      const texto = await resposta.text();
      throw new Error(`Expo Push API respondeu ${resposta.status}: ${texto}`);
    }

    const corpoResposta = (await resposta.json()) as {
      data?: { status?: string; message?: string };
    };
    if (corpoResposta.data?.status === 'error') {
      // Token inválido/expirado (ex.: app desinstalado) , não vale a
      // pena o BullMQ retentar, mas também não travamos nada por isso.
      this.logger.warn(
        `Expo Push API recusou o envio: ${corpoResposta.data.message}`,
      );
    }
  }
}
