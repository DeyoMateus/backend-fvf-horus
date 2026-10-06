import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FILA_NOTIFICACOES_WHATSAPP } from './whatsapp-notifications.constants';
import type { JobNotificacaoWhatsapp } from './whatsapp-notifications.service';

/**
 * Consome a fila e chama a WhatsApp Business Cloud API (Meta) direto ,
 * https://developers.facebook.com/docs/whatsapp/cloud-api. Requer um
 * template pré-aprovado pela Meta pra mensagens iniciadas pela empresa
 * (fora de uma janela de 24h de conversa) , "fvf_horus_alerta_critico"
 * é um placeholder; troque pelo nome real do template quando ele for
 * criado e aprovado no WhatsApp Manager.
 */
@Processor(FILA_NOTIFICACOES_WHATSAPP)
export class WhatsappNotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappNotificationsProcessor.name);

  async process(job: Job<JobNotificacaoWhatsapp>): Promise<void> {
    const { telefone, mensagem } = job.data;

    // Rodada 160: Evolution API (instância própria) tem prioridade.
    const evolutionUrl = process.env.EVOLUTION_API_URL;
    const evolutionKey = process.env.EVOLUTION_API_KEY;
    const evolutionInstancia = process.env.EVOLUTION_INSTANCE;
    if (evolutionUrl && evolutionKey && evolutionInstancia) {
      const resp = await fetch(
        `${evolutionUrl.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(evolutionInstancia)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: evolutionKey,
          },
          body: JSON.stringify({
            number: telefone.replace(/\D/g, ''),
            text: mensagem,
          }),
        },
      ).catch((err: Error) => {
        this.logger.error(
          `Evolution API inacessível (${evolutionUrl}): ${err.message}`,
        );
        throw err;
      });
      if (!resp.ok) {
        const texto = await resp.text();
        this.logger.error(
          `Evolution API respondeu ${resp.status}: ${texto}`,
        );
        throw new Error(`Evolution API respondeu ${resp.status}: ${texto}`);
      }
      this.logger.log(
        `WhatsApp enviado via Evolution para ***${telefone.slice(-4)}.`,
      );
      return;
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_TOKEN;

    if (!phoneNumberId || !token) {
      this.logger.warn(
        'WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID ausentes , job não deveria ter sido enfileirado.',
      );
      return;
    }

    const resposta = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telefone.replace(/\D/g, ''),
          type: 'template',
          template: {
            name:
              process.env.WHATSAPP_TEMPLATE_NOME ?? 'fvf_horus_alerta_critico',
            language: { code: 'pt_BR' },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: mensagem }] },
            ],
          },
        }),
      },
    );

    if (!resposta.ok) {
      const texto = await resposta.text();
      throw new Error(
        `WhatsApp Cloud API respondeu ${resposta.status}: ${texto}`,
      );
    }
  }
}
