import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FILA_NOTIFICACOES_PUSH } from './push-notifications.constants';
import type { JobNotificacaoPush } from './push-notifications.service';

/**
 * Canal Android com a VOZ de cada tipo de alerta (mp3 falado dentro do
 * app; mobile/src/notifications/sonsAlerta.ts , manter em sincronia).
 * O som é do canal no Android; o app cria todos na abertura. Tipos sem
 * voz própria usam a frase genérica.
 */
const SOM_POR_TIPO: Record<string, string> = {
  DIRECAO_CONTINUA_PROXIMA_LIMITE: 'direcao_300',
  DIRECAO_CONTINUA_EXCEDIDA: 'direcao_330',
  DIRECAO_RETOMADA_SEM_PAUSA: 'direcao_330',
  JORNADA_DIRECAO_PROXIMA_LIMITE: 'jornada_proxima',
  JORNADA_DIRECAO_EXCEDIDA: 'jornada_excedida',
  ESPERA_PROXIMA_LIMITE: 'espera_proxima',
  ESPERA_LIMITE_LEGAL_ATINGIDO: 'espera_limite',
  TEMPO_INDEFINIDO_PROXIMO_LIMITE: 'indefinido_15',
  TEMPO_INDEFINIDO_PROLONGADO: 'indefinido_30',
};

function canalDoPush(dados?: Record<string, unknown>): string {
  const tipo = typeof dados?.tipo === 'string' ? dados.tipo : undefined;
  // Avisos que não são alerta de jornada (ajuste de ponto, tratamento)
  // ficam no canal padrão, sem voz de alerta.
  if (
    !tipo ||
    tipo.startsWith('SOLICITACAO_') ||
    tipo === 'TRATAMENTO_PONTO'
  ) {
    return 'alertas-jornada-v2';
  }
  return `alerta-voz-${SOM_POR_TIPO[tipo] ?? 'generico'}-v1`;
}

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Consome a fila e chama a Expo Push API (gratuita, não precisa de
 * credencial de app store nem certificado próprio , é o mesmo serviço
 * que o Expo Go e apps standalone usam para push no Android e iOS).
 */
@Processor(FILA_NOTIFICACOES_PUSH)
export class PushNotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(PushNotificationsProcessor.name);

  private async conferirRecibo(ticketId: string): Promise<void> {
    try {
      await new Promise((r) => setTimeout(r, 15_000));
      const r = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ ids: [ticketId] }),
      });
      const json = (await r.json()) as {
        data?: Record<
          string,
          { status?: string; message?: string; details?: { error?: string } }
        >;
      };
      const rec = json.data?.[ticketId];
      if (rec?.status === 'error') {
        this.logger.warn(
          `Push NÃO entregue (${rec.details?.error ?? 'erro'}): ${rec.message ?? ''}`,
        );
      } else if (rec?.status === 'ok') {
        this.logger.log('Push entregue ao Google/Apple (recibo ok).');
      }
    } catch {
      // diagnóstico apenas
    }
  }

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
        channelId: canalDoPush(dados),
      }),
    });

    if (!resposta.ok) {
      const texto = await resposta.text();
      throw new Error(`Expo Push API respondeu ${resposta.status}: ${texto}`);
    }

    const corpoResposta = (await resposta.json()) as {
      data?: { status?: string; message?: string; id?: string };
    };
    if (corpoResposta.data?.status === 'error') {
      // Token inválido/expirado (ex.: app desinstalado) , não vale a
      // pena o BullMQ retentar, mas também não travamos nada por isso.
      this.logger.warn(
        `Expo Push API recusou o envio: ${corpoResposta.data.message}`,
      );
    } else if (corpoResposta.data?.id) {
      // O "ok" do envio só diz que a Expo ACEITOU a mensagem; a entrega ao
      // Google (FCM) é confirmada depois, no recibo. Erros típicos:
      // InvalidCredentials/MismatchSenderId (FCM não configurado no EAS) e
      // DeviceNotRegistered (app desinstalado/token velho). Só loga.
      void this.conferirRecibo(corpoResposta.data.id);
    }
  }
}
