import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
export interface JobNotificacaoPush {
    pushToken: string;
    titulo: string;
    corpo: string;
    dados?: Record<string, unknown>;
}
export declare class PushNotificationsService {
    private readonly fila;
    private readonly prisma;
    private readonly logger;
    constructor(fila: Queue<JobNotificacaoPush>, prisma: PrismaService);
    notificarMotorista(motoristaId: string, titulo: string, corpo: string, dados?: Record<string, unknown>): Promise<void>;
}
