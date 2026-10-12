import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
export declare class MonitoramentoOperacionalService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly whatsapp;
    private readonly email;
    private readonly audit;
    private readonly logger;
    private timer;
    private emExecucao;
    private ultimoEstado;
    private readonly emProblema;
    constructor(prisma: PrismaService, whatsapp: WhatsappNotificationsService, email: EmailService, audit: AuditService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private canaisConfigurados;
    verificar(): Promise<EstadoOperacional>;
    ultimo(): EstadoOperacional | null;
    private ciclo;
    processarTransicoes(verificacoes: ResultadoVerificacao[]): Promise<void>;
    private avisar;
}
