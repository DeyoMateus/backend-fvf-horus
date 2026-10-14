import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { PushNotificationsService } from '../common/notifications/push-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
export declare const TIPO_PUSH_NOVA_POLITICA = "PRIVACIDADE_NOVA_VERSAO";
export declare class PrivacidadeAvisoPoliticaService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly push;
    private readonly audit;
    private readonly logger;
    private timer;
    private inicial;
    private emExecucao;
    static readonly REAVISO_MS: number;
    constructor(prisma: PrismaService, push: PushNotificationsService, audit: AuditService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    executar(): Promise<number>;
    avisarPendentes(agora?: Date): Promise<number>;
}
