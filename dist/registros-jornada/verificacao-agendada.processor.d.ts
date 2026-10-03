import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { JobVerificacaoJornada } from './verificacao-agendada.constants';
import { RegistrosJornadaService } from './registros-jornada.service';
export declare class VerificacaoJornadaAgendadaProcessor extends WorkerHost {
    private readonly registrosJornada;
    private readonly logger;
    constructor(registrosJornada: RegistrosJornadaService);
    process(job: Job<JobVerificacaoJornada>): Promise<void>;
}
