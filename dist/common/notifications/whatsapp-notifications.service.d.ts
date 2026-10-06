import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
export interface JobNotificacaoWhatsapp {
    telefone: string;
    mensagem: string;
}
export declare class WhatsappNotificationsService {
    private readonly fila;
    private readonly prisma;
    private readonly logger;
    constructor(fila: Queue<JobNotificacaoWhatsapp>, prisma: PrismaService);
    configurado(): boolean;
    private avisoNaoConfiguradoEmitido;
    private avisarSeNaoConfigurado;
    private enfileirar;
    notificarGestoresDaEmpresa(empresaId: string, mensagem: string): Promise<void>;
}
