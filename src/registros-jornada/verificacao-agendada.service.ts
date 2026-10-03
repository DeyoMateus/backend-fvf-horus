import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  FILA_VERIFICACAO_JORNADA,
  JobVerificacaoJornada,
} from './verificacao-agendada.constants';

/**
 * Produtor da fila de verificação agendada (Rodada 21) , substitui a
 * ideia de "escanear todo mundo com jornada aberta a cada N minutos"
 * (Rodada 19/20) por "agendar um único job futuro por motorista,
 * exatamente na hora em que o próximo limiar legal seria cruzado" (ver
 * `JornadaLegalService.calcularProximoLimiar`).
 *
 * Um motorista tem no máximo UM job pendente por vez , `jobId` fixo
 * por motorista, então reagendar (ex.: motorista bateu um evento novo,
 * mudando quando o próximo limiar será cruzado) primeiro remove o job
 * antigo, se ainda não tiver disparado, antes de adicionar o novo. Sem
 * isso, cada evento novo empilharia mais um job, e o motorista
 * acabaria sendo verificado várias vezes por engano.
 *
 * Fail-open, igual a `PushNotificationsService`/`WhatsappNotificationsService`:
 * uma falha ao agendar (ex.: Redis fora do ar) nunca pode travar o
 * registro de ponto , na pior hipótese, o motorista só deixa de ganhar
 * o aviso antecipado e volta a depender só da varredura periódica de
 * segurança (`MonitoramentoJornadaAbertaService`) como reserva.
 */
@Injectable()
export class VerificacaoJornadaAgendadaService {
  private readonly logger = new Logger(VerificacaoJornadaAgendadaService.name);

  constructor(
    @InjectQueue(FILA_VERIFICACAO_JORNADA)
    private readonly fila: Queue<JobVerificacaoJornada>,
  ) {}

  /** Agenda (substituindo qualquer job pendente anterior) a próxima verificação deste motorista, daqui a `emMs`. */
  async agendar(motoristaId: string, emMs: number): Promise<void> {
    try {
      const jobId = this.jobIdDoMotorista(motoristaId);

      const jobExistente = await this.fila.getJob(jobId);
      if (jobExistente) {
        const estado = await jobExistente.getState();
        // Só faz sentido remover se ainda não começou a rodar , um job
        // 'active'/'completed' não deve ser mexido (e o BullMQ recusaria
        // remover um job ativo de qualquer forma).
        if (estado === 'delayed' || estado === 'waiting') {
          await jobExistente.remove();
        } else {
          return; // já está rodando ou já rodou , deixa o job atual seguir, não empilha outro
        }
      }

      await this.fila.add(
        'verificar',
        { motoristaId },
        {
          jobId,
          delay: Math.max(0, emMs),
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );
    } catch (err) {
      this.logger.warn(
        `Falha ao agendar verificação proativa para motorista ${motoristaId}: ${(err as Error).message}`,
      );
    }
  }

  /** Cancela o job pendente deste motorista, se houver , usado quando a jornada fecha (FIM_JORNADA), sem nada mais a esperar. */
  async cancelar(motoristaId: string): Promise<void> {
    try {
      const job = await this.fila.getJob(this.jobIdDoMotorista(motoristaId));
      if (!job) return;
      const estado = await job.getState();
      if (estado === 'delayed' || estado === 'waiting') await job.remove();
    } catch (err) {
      this.logger.warn(
        `Falha ao cancelar verificação agendada para motorista ${motoristaId}: ${(err as Error).message}`,
      );
    }
  }

  private jobIdDoMotorista(motoristaId: string): string {
    return `verificar-jornada:${motoristaId}`;
  }
}
