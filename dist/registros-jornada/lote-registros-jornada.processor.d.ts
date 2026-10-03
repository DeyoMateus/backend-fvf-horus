import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { JobLoteRegistroJornada, ResultadoItemLote } from './lote-registros-jornada.constants';
import { RegistrosJornadaService } from './registros-jornada.service';
export declare class LoteRegistrosJornadaProcessor extends WorkerHost {
    private readonly registrosJornada;
    private readonly prisma;
    private readonly logger;
    constructor(registrosJornada: RegistrosJornadaService, prisma: PrismaService);
    process(job: Job<JobLoteRegistroJornada>): Promise<ResultadoItemLote[]>;
}
