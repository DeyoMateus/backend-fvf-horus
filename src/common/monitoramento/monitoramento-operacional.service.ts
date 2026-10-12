import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { WhatsappNotificationsService } from '../notifications/whatsapp-notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ResultadoVerificacao {
  chave: string;
  ok: boolean;
  detalhe: string;
}

export interface EstadoOperacional {
  saudavel: boolean;
  verificadoEm: string;
  verificacoes: ResultadoVerificacao[];
}

const REPETIR_ALERTA_A_CADA_MS = 6 * 60 * 60 * 1000;
const LIMITE_FALHAS_WHATSAPP_NA_HORA = 5;

/**
 * Rodada 213: monitoramento operacional. Avisa por um canal que NÃO
 * depende do WhatsApp (e-mail e/ou webhook) quando algo que alimenta os
 * alertas para (banco, Redis/filas, WhatsApp desconectado ou falhando).
 *
 * Limite honesto: se o próprio backend cair, ele não consegue avisar de si
 * mesmo. Para isso é preciso um monitor externo apontando para
 * `GET /health/completo` (ver docs de monitoramento).
 *
 * Variáveis: ALERTA_OPERACIONAL_EMAIL (lista separada por vírgula),
 * ALERTA_WEBHOOK_URL (Slack/Discord/ntfy/Telegram-bridge: recebe JSON com
 * `text` e `content`), INTERVALO_MONITORAMENTO_MS (padrão 5 min).
 */
@Injectable()
export class MonitoramentoOperacionalService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MonitoramentoOperacionalService.name);
  private timer: NodeJS.Timeout | null = null;
  private emExecucao = false;
  private ultimoEstado: EstadoOperacional | null = null;
  /** chave -> momento do último aviso de problema (ausente = estava ok). */
  private readonly emProblema = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappNotificationsService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const intervalo = Number(process.env.INTERVALO_MONITORAMENTO_MS ?? 5 * 60 * 1000);
    this.timer = setInterval(() => void this.ciclo(), intervalo);
    // Primeira checagem logo após a subida (dá tempo do Redis conectar).
    setTimeout(() => void this.ciclo(), 30_000).unref();
    if (!this.canaisConfigurados()) {
      this.logger.warn(
        'Monitoramento sem canal de aviso: defina ALERTA_OPERACIONAL_EMAIL e/ou ALERTA_WEBHOOK_URL para ser avisado quando o WhatsApp/Redis/banco falhar.',
      );
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private canaisConfigurados(): boolean {
    return !!(process.env.ALERTA_OPERACIONAL_EMAIL || process.env.ALERTA_WEBHOOK_URL);
  }

  /** Estado atual (executa as checagens agora). Usado por /health/completo. */
  async verificar(): Promise<EstadoOperacional> {
    const verificacoes: ResultadoVerificacao[] = [];

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      verificacoes.push({ chave: 'banco', ok: true, detalhe: 'ok' });
    } catch {
      verificacoes.push({ chave: 'banco', ok: false, detalhe: 'banco de dados indisponível' });
    }

    const zap = await this.whatsapp.diagnostico();
    verificacoes.push({
      chave: 'redis',
      ok: zap.redis === 'ok',
      detalhe: zap.redis === 'ok' ? 'ok' : 'Redis (filas de notificação) indisponível',
    });
    if (zap.configurado) {
      const evolucaoOk = zap.evolution === 'ok' || zap.evolution === 'nao_configurada';
      verificacoes.push({
        chave: 'whatsapp_conexao',
        ok: evolucaoOk,
        detalhe: evolucaoOk
          ? 'ok'
          : zap.evolution === 'desconectada'
            ? 'a instância do WhatsApp está desconectada (reescanear o QR Code)'
            : 'a Evolution API não respondeu',
      });
      verificacoes.push({
        chave: 'whatsapp_envio',
        ok: zap.falhasUltimaHora < LIMITE_FALHAS_WHATSAPP_NA_HORA,
        detalhe:
          zap.falhasUltimaHora < LIMITE_FALHAS_WHATSAPP_NA_HORA
            ? 'ok'
            : `${zap.falhasUltimaHora} envios de WhatsApp falharam na última hora`,
      });
    } else {
      verificacoes.push({
        chave: 'whatsapp_configuracao',
        ok: false,
        detalhe: 'WhatsApp não configurado: nenhum alerta por WhatsApp será enviado',
      });
    }

    const estado: EstadoOperacional = {
      saudavel: verificacoes.every((v) => v.ok),
      verificadoEm: new Date().toISOString(),
      verificacoes,
    };
    this.ultimoEstado = estado;
    return estado;
  }

  ultimo(): EstadoOperacional | null {
    return this.ultimoEstado;
  }

  private async ciclo() {
    if (this.emExecucao) return;
    this.emExecucao = true;
    try {
      const estado = await this.verificar();
      await this.processarTransicoes(estado.verificacoes);
    } catch (err) {
      this.logger.error('Falha no ciclo de monitoramento', err as Error);
    } finally {
      this.emExecucao = false;
    }
  }

  /** Separado para facilitar teste: decide quando avisar problema/recuperação. */
  async processarTransicoes(verificacoes: ResultadoVerificacao[]) {
    const agora = Date.now();
    for (const v of verificacoes) {
      const avisadoEm = this.emProblema.get(v.chave);
      if (!v.ok) {
        if (avisadoEm === undefined || agora - avisadoEm >= REPETIR_ALERTA_A_CADA_MS) {
          this.emProblema.set(v.chave, agora);
          await this.avisar(
            `[FVF Hórus] PROBLEMA: ${v.detalhe}`,
            `Detectado em ${new Date(agora).toISOString()}. Enquanto isso não for resolvido, alertas de jornada podem não chegar aos gestores.`,
            v.chave,
            'PROBLEMA',
          );
        }
      } else if (avisadoEm !== undefined) {
        this.emProblema.delete(v.chave);
        await this.avisar(
          `[FVF Hórus] RESOLVIDO: ${v.chave}`,
          `A verificação "${v.chave}" voltou ao normal em ${new Date(agora).toISOString()}.`,
          v.chave,
          'RESOLVIDO',
        );
      }
    }
  }

  private async avisar(
    titulo: string,
    corpo: string,
    chave: string,
    tipo: 'PROBLEMA' | 'RESOLVIDO',
  ) {
    this.logger.warn(`${titulo} | ${corpo}`);
    void this.audit.registrar({
      actorType: ActorType.SISTEMA,
      acao: 'MONITORAMENTO_OPERACIONAL',
      entidade: 'Sistema',
      detalhes: { chave, tipo, titulo },
    });

    const destinos = (process.env.ALERTA_OPERACIONAL_EMAIL ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    for (const destino of destinos) {
      await this.email.enviar(destino, titulo, `<p>${corpo}</p>`);
    }

    const webhook = process.env.ALERTA_WEBHOOK_URL;
    if (webhook) {
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `${titulo}\n${corpo}`, content: `${titulo}\n${corpo}` }),
          signal: AbortSignal.timeout(8_000),
        });
      } catch (err) {
        this.logger.error(`Webhook de alerta operacional falhou: ${(err as Error).message}`);
      }
    }
  }
}
