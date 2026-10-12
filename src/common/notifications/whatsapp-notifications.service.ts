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
import { mascararDadosPessoais } from './minimizar-dados-whatsapp.util';

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

  /**
   * Rodada 160: dois provedores possíveis. Evolution API (instância própria
   * no Easypanel, texto livre, sem template) tem prioridade; se não estiver
   * configurada, vale a Cloud API oficial da Meta como antes.
   */
  configurado(): boolean {
    return (
      !!(
        process.env.EVOLUTION_API_URL &&
        process.env.EVOLUTION_API_KEY &&
        process.env.EVOLUTION_INSTANCE
      ) ||
      !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
    );
  }

  private avisoNaoConfiguradoEmitido = false;

  /** Rodada 162: antes o "não configurado" era silencioso e ninguém sabia por que nada chegava. Agora loga um aviso (uma vez). */
  private avisarSeNaoConfigurado(): boolean {
    if (this.configurado()) return true;
    if (!this.avisoNaoConfiguradoEmitido) {
      this.avisoNaoConfiguradoEmitido = true;
      this.logger.warn(
        'WhatsApp NÃO configurado: faltam EVOLUTION_API_URL/EVOLUTION_API_KEY/EVOLUTION_INSTANCE (ou as variáveis da Meta). Nenhuma mensagem será enviada.',
      );
    }
    return false;
  }

  /**
   * Moldura formal comum a todos os alertas por WhatsApp: identifica o
   * remetente (FVF Hórus), deixa claro que é um alerta automático e indica
   * a transportadora a que se refere. O texto específico do alerta vai no meio.
   */
  private formatarMensagemFormal(corpo: string, razaoSocial?: string): string {
    const empresa = razaoSocial ? `Transportadora: ${razaoSocial}\n\n` : '';
    return (
      '*FVF Hórus | Alerta do Sistema de Controle de Jornada*\n\n' +
      'Prezado(a) gestor(a),\n\n' +
      'Informamos que o sistema FVF Hórus identificou a seguinte ocorrência, que requer a sua atenção:\n\n' +
      empresa +
      `${corpo}\n\n` +
      'Recomendamos acessar o painel do FVF Hórus para consultar os detalhes e tomar as providências cabíveis.\n\n' +
      'Atenciosamente,\n' +
      'Equipe FVF Hórus\n' +
      '_Mensagem automática, por favor não responda._'
    );
  }

  private async enfileirar(telefone: string, mensagem: string): Promise<void> {
    await this.fila.add(
      'enviar',
      { telefone, mensagem },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: { age: 24 * 3600, count: 50 },
      },
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
    if (!this.avisarSeNaoConfigurado()) return; // fail-open , ver comentário da classe

    try {
      const empresa = await this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { grupoId: true, fusoHorario: true, razaoSocial: true },
      });
      if (!empresa) return;

      const gestores = await this.prisma.usuarioEmpresa.findMany({
        where: {
          grupoId: empresa.grupoId,
          ativo: true,
        },
        select: {
          telefoneWhatsapp: true,
          telefoneGerenciamentoRisco: true,
          recebeWhatsappAlertas: true,
          recebeWhatsappEquipeGr: true,
          fusoOffsetMin: true,
        },
      });
      const offsetEmpresaMin = offsetPadraoDaEmpresa(empresa.fusoHorario);

      // Rodada 163/164: destinatários = número da equipe de Gerenciamento de
      // Risco (padrão) e, se o super admin ligou, o WhatsApp pessoal do
      // usuário. Números repetidos recebem uma mensagem só.
      const jaEnfileirados = new Set<string>();
      for (const gestor of gestores) {
        const fuso = offsetValido(gestor.fusoOffsetMin)
          ? gestor.fusoOffsetMin
          : offsetEmpresaMin;
        // Rodada 164: padrão = só a equipe de GR; o WhatsApp pessoal só
        // recebe se o super admin ligou (o gestor já é avisado na plataforma).
        for (const telefone of [
          gestor.recebeWhatsappAlertas ? gestor.telefoneWhatsapp : null,
          gestor.recebeWhatsappEquipeGr
            ? gestor.telefoneGerenciamentoRisco
            : null,
        ]) {
          if (!telefone || jaEnfileirados.has(telefone)) continue;
          jaEnfileirados.add(telefone);
          // Rodada 148: a hora vai no fuso de QUEM recebe (07h em Brasília
          // é 06h em Cuiabá); sem fuso aprendido, o da transportadora.
          await this.enfileirar(
            telefone,
            this.formatarMensagemFormal(
              mascararDadosPessoais(renderizarHorarios(mensagem, fuso)),
              empresa.razaoSocial,
            ),
          );
        }
      }
      if (jaEnfileirados.size === 0) {
        this.logger.warn(
          `Nenhum telefone de WhatsApp (gestor ou Gerenciamento de Risco) cadastrado no grupo da empresa ${empresaId}: WhatsApp não enviado.`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Falha ao enfileirar notificação WhatsApp para empresa ${empresaId}`,
        err as Error,
      );
    }
  }

  /**
   * Rodada 213: estado do canal de WhatsApp para o monitoramento. Nunca
   * lança; qualquer falha vira um estado "erro"/"indisponivel".
   */
  async diagnostico(): Promise<{
    configurado: boolean;
    redis: 'ok' | 'erro';
    falhasUltimaHora: number;
    evolution: 'ok' | 'desconectada' | 'indisponivel' | 'nao_configurada';
  }> {
    const configurado = this.configurado();
    let redis: 'ok' | 'erro' = 'ok';
    let falhasUltimaHora = 0;
    try {
      // Sem `client`/ping direto (a API do Queue varia entre versões do
      // BullMQ): qualquer chamada à fila serve de teste do Redis, com
      // prazo curto para não ficar pendurada se o Redis estiver fora.
      const falhas = await Promise.race([
        this.fila.getFailed(0, 49),
        new Promise<never>((_, rejeitar) =>
          setTimeout(() => rejeitar(new Error('Redis sem resposta')), 5_000),
        ),
      ]);
      const umaHoraAtras = Date.now() - 60 * 60 * 1000;
      falhasUltimaHora = falhas.filter(
        (j) => (j.finishedOn ?? 0) >= umaHoraAtras,
      ).length;
    } catch {
      redis = 'erro';
    }

    let evolution: 'ok' | 'desconectada' | 'indisponivel' | 'nao_configurada' =
      'nao_configurada';
    const url = process.env.EVOLUTION_API_URL;
    const chave = process.env.EVOLUTION_API_KEY;
    const instancia = process.env.EVOLUTION_INSTANCE;
    if (url && chave && instancia) {
      try {
        const resp = await fetch(
          `${url.replace(/\/+$/, '')}/instance/connectionState/${encodeURIComponent(instancia)}`,
          { headers: { apikey: chave }, signal: AbortSignal.timeout(8_000) },
        );
        if (!resp.ok) {
          evolution = 'indisponivel';
        } else {
          const corpo = (await resp.json()) as {
            instance?: { state?: string };
            state?: string;
          };
          const estado = corpo.instance?.state ?? corpo.state;
          evolution = estado === 'open' ? 'ok' : 'desconectada';
        }
      } catch {
        evolution = 'indisponivel';
      }
    }
    return { configurado, redis, falhasUltimaHora, evolution };
  }
}
