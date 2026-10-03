import { AuditService } from '../common/audit/audit.service';
import { WhatsappNotificationsService } from '../common/notifications/whatsapp-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateFolgaConcedidaDto } from './dto/create-folga-concedida.dto';
export declare class FolgaConcedidaService {
    private readonly prisma;
    private readonly audit;
    private readonly tenant;
    private readonly whatsapp;
    constructor(prisma: PrismaService, audit: AuditService, tenant: TenantService, whatsapp: WhatsappNotificationsService);
    conceder(motoristaId: string, dto: CreateFolgaConcedidaDto, usuarioId: string, grupoIdSolicitante: string): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        motivo: string | null;
        concedidaPorUsuarioId: string;
    }>;
    listarPorMotorista(motoristaId: string, grupoIdSolicitante: string): Promise<({
        concedidaPorUsuario: {
            id: string;
            nome: string;
        };
    } & {
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        motivo: string | null;
        concedidaPorUsuarioId: string;
    })[]>;
    listarMinhas(motoristaId: string): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        motivo: string | null;
        concedidaPorUsuarioId: string;
    }[]>;
    anular(motoristaId: string, dataStr: string): Promise<{
        anulada: boolean;
    }>;
}
