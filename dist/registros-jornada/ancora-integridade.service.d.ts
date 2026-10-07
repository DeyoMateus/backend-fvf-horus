import { AuditService } from '../common/audit/audit.service';
import { WhatsappNotificationsService } from '../common/notifications/whatsapp-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
export interface ResultadoAncora {
    estado: 'sem_storage' | 'baseline_criada' | 'ok' | 'reiniciada' | 'violacao' | 'ancora_adulterada';
    motoristas?: number;
    violacoes?: number;
}
export declare class AncoraIntegridadeService {
    private readonly prisma;
    private readonly storage;
    private readonly whatsapp;
    private readonly audit;
    private readonly logger;
    private avisoStorageEmitido;
    private readonly avisados;
    constructor(prisma: PrismaService, storage: StorageService, whatsapp: WhatsappNotificationsService, audit: AuditService);
    private chaveHmac;
    private assinar;
    private assinaturaConfere;
    private montarSnapshot;
    private lerUltima;
    private gravarUltima;
    private registrarArquivo;
    private compararComAncora;
    private reportar;
    executar(): Promise<ResultadoAncora>;
}
