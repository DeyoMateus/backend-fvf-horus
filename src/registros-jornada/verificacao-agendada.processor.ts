import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  FILA_VERIFICACAO_JORNADA,
  JobVerificacaoJornada,
} from './verificacao-agendada.constants';
import { RegistrosJornadaService } from './registros-jornada.service';

/**
 * Consome a fila de verificação agendada (Rodada 21) , dispara
 * exatamente quando `JornadaLegalService.calcularProximoLimiar`
 * previu que o motorista cruzaria o próximo limiar legal, supondo que
 * nada mudasse até lá.
 *
 * Sempre reavalia com dados FRESCOS no momento do disparo (nunca
 * confia no cálculo que agendou o job) , se o motorista registrou
 * outro evento nesse meio tempo (ex.: parou pra descansar), o estado
 * real já reflete isso e o motor de limites legais simplesmente não
 * vai gerar alerta nenhum. Isso é o que torna o agendamento seguro
 * mesmo sendo só uma estimativa: o job errar a hora por alguns
 * segundos/minutos nunca produz um alerta errado, só um alerta um
 * pouco cedo ou tarde , e a lógica de reagendamento em cascata (ver
 * `RegistrosJornadaService.verificarEAgendarProximoMotorista`) se
 * autocorrige a cada evento novo de qualquer forma.
 */
@Processor(FILA_VERIFICACAO_JORNADA)
export class VerificacaoJornadaAgendadaProcessor extends WorkerHost {
  private readonly logger = new Logger(
    VerificacaoJornadaAgendadaProcessor.name,
  );

  constructor(private readonly registrosJornada: RegistrosJornadaService) {
    super();
  }

  async process(job: Job<JobVerificacaoJornada>): Promise<void> {
    const { motoristaId } = job.data;
    try {
      await this.registrosJornada.verificarEAgendarProximoMotorista(
        motoristaId,
      );
    } catch (err) {
      // Fail-open: mesmo padrão dos demais processors desta fila ,
      // erro aqui nunca pode derrubar o worker. O BullMQ ainda tenta
      // de novo pelo `attempts` padrão da fila antes de desistir, e a
      // varredura periódica de segurança cobre o que sobrar.
      this.logger.warn(
        `Falha ao verificar motorista ${motoristaId} via job agendado: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
