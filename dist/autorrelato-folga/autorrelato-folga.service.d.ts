import { AuditService } from '../common/audit/audit.service';
import { WhatsappNotificationsService } from '../common/notifications/whatsapp-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateAutorrelatoFolgaDto } from './dto/create-autorrelato-folga.dto';
export declare class AutorrelatoFolgaService {
    private readonly prisma;
    private readonly audit;
    private readonly tenant;
    private readonly whatsapp;
    constructor(prisma: PrismaService, audit: AuditService, tenant: TenantService, whatsapp: WhatsappNotificationsService);
    autorrelatar(motoristaId: string, dto: CreateAutorrelatoFolgaDto): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        observacao: string | null;
    }>;
    listarPorMotorista(motoristaId: string, grupoIdSolicitante: string): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        observacao: string | null;
    }[]>;
    listarMinhas(motoristaId: string): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        observacao: string | null;
    }[]>;
    anular(motoristaId: string, dataStr: string): Promise<{
        anulada: boolean;
    }>;
    diasSemInteracao(grupoId: string, dias?: number): Promise<{
        motoristaId: string;
        nome: string;
        diasSemInteracao: string[];
    }[]>;
}
