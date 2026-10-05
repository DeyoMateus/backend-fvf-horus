import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  offsetPadraoDaEmpresa,
  offsetValido,
  renderizarHorarios,
} from '../fuso/fuso-brasil.util';
import { PrismaService } from '../prisma/prisma.service';
import { FILA_NOTIFICACOES_WHATSAPP } from './whatsapp-notifications.constants';

export interface JobNotificacaoWhatsapp {
  telefone: string; // E.164, ex.: +5511999998888
  mensagem: string;
}

/**
 * Canal adicional pro GESTOR (não o motorista , esse já tem push via
 * Expo): alertas críticos de jornada também por WhatsApp, pra quem
 * configurar um telefone. Mesmo padrão de todo o resto do projeto:
 * enfileira em vez de chamar a API síncrono, e fail-open total , sem
 * WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID configurados no .env, este
 * serviço simplesmente não enfileira nada (loga uma vez e segue), sem
 * afetar em nada o resto do app.
 *
 * Usa a WhatsApp Business Cloud API da Meta direto via fetch, sem SDK
 * , mesma decisão já tomada pro cliente do R2 (menos dependências
 * transitivas = menos risco de instalação corrompida neste ambiente).
 */
@Injectable()
export class WhatsappNotificationsService {
  private readonly logger = new Logger(WhatsappNotificationsService.name);

  constructor(
    @InjectQueue(FILA_NOTIFICACOES_WHATSAPP)
    private readonly fila: Queue<JobNotificacaoWhatsapp>,
    private readonly prisma: PrismaService,
  ) {}

  configurado(): boolean {
    return !!(
      process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
    );
  }

  /**
   * Notifica todos os gestores/admins do GRUPO ao qual esta empresa
   * (CNPJ) pertence, que tiverem telefone cadastrado , usuários são do
   * grupo (podem gerenciar mais de um CNPJ), não da empresa em si.
   */
  async notificarGestoresDaEmpresa(
    empresaId: string,
    mensagem: string,
  ): Promise<void> {
    if (!this.configurado()) return; // fail-open silencioso , ver comentário da classe

    try {
      const empresa = await this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { grupoId: true, fusoHorario: true },
      });
      if (!empresa) return;

      const gestores = await this.prisma.usuarioEmpresa.findMany({
        where: {
          grupoId: empresa.grupoId,
          ativo: true,
          telefoneWhatsapp: { not: null },
        },
        select: { telefoneWhatsapp: true, fusoOffsetMin: true },
      });
      const offsetEmpresaMin = offsetPadraoDaEmpresa(empresa.fusoHorario);

      for (const gestor of gestores) {
        if (!gestor.telefoneWhatsapp) continue;
        await this.fila.add(
          'enviar',
          {
            telefone: gestor.telefoneWhatsapp,
            // Rodada 148: a hora vai no fuso de QUEM recebe (07h em Brasília
            // é 06h em Cuiabá); sem fuso aprendido, o da transportadora.
            mensagem: renderizarHorarios(
              mensagem,
              offsetValido(gestor.fusoOffsetMin)
                ? gestor.fusoOffsetMin
                : offsetEmpresaMin,
            ),
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: true,
            removeOnFail: 50,
          },
        );
      }
    } catch (err) {
      this.logger.error(
        `Falha ao enfileirar notificação WhatsApp para empresa ${empresaId}`,
        err as Error,
      );
    }
  }
}
