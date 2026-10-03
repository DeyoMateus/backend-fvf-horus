import { Queue } from 'bullmq';
import { JobVerificacaoJornada } from './verificacao-agendada.constants';
export declare class VerificacaoJornadaAgendadaService {
    private readonly fila;
    private readonly logger;
    constructor(fila: Queue<JobVerificacaoJornada>);
    agendar(motoristaId: string, emMs: number): Promise<void>;
    cancelar(motoristaId: string): Promise<void>;
    private jobIdDoMotorista;
}
