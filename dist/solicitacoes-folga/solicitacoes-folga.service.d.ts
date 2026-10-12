import { AuditService } from '../common/audit/audit.service';
import { PushNotificationsService } from '../common/notifications/push-notifications.service';
import { WhatsappNotificationsService } from '../common/notifications/whatsapp-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { FolgaConcedidaService } from '../folga-concedida/folga-concedida.service';
import { CreateSolicitacaoFolgaDto } from './dto/create-solicitacao-folga.dto';
export declare const MAXIMO_DIAS_POR_PEDIDO = 15;
export declare class SolicitacoesFolgaService {
    private readonly prisma;
    private readonly audit;
    private readonly tenant;
    private readonly push;
    private readonly whatsapp;
    private readonly folgaConcedida;
    constructor(prisma: PrismaService, audit: AuditService, tenant: TenantService, push: PushNotificationsService, whatsapp: WhatsappNotificationsService, folgaConcedida: FolgaConcedidaService);
    criar(motoristaId: string, dto: CreateSolicitacaoFolgaDto): Promise<{
        decididoPorUsuario: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoFolga;
        motoristaId: string;
        observacao: string | null;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        dataInicio: Date;
        dataFim: Date;
    }>;
    listarMinhas(motoristaId: string): Promise<({
        decididoPorUsuario: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoFolga;
        motoristaId: string;
        observacao: string | null;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        dataInicio: Date;
        dataFim: Date;
    })[]>;
    listarPorMotorista(motoristaId: string, grupoIdSolicitante: string): Promise<({
        decididoPorUsuario: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoFolga;
        motoristaId: string;
        observacao: string | null;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        dataInicio: Date;
        dataFim: Date;
    })[]>;
    listarPendentesDoGrupo(grupoIdSolicitante: string): Promise<({
        motorista: {
            id: string;
            nome: string;
        };
        decididoPorUsuario: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoFolga;
        motoristaId: string;
        observacao: string | null;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        dataInicio: Date;
        dataFim: Date;
    })[]>;
    contarPendentesDoGrupo(grupoIdSolicitante: string): Promise<{
        total: number;
    }>;
    listarHistoricoDoGrupo(grupoIdSolicitante: string, page?: number, pageSize?: number, ordem?: 'asc' | 'desc'): Promise<{
        dados: ({
            motorista: {
                id: string;
                nome: string;
            };
            decididoPorUsuario: {
                id: string;
                nome: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.StatusSolicitacaoFolga;
            motoristaId: string;
            observacao: string | null;
            decididoPorUsuarioId: string | null;
            decididoEm: Date | null;
            motivoDecisao: string | null;
            dataInicio: Date;
            dataFim: Date;
        })[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    aprovar(solicitacaoId: string, motivoDecisao: string | undefined, usuarioId: string, grupoIdSolicitante: string): Promise<{
        decididoPorUsuario: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoFolga;
        motoristaId: string;
        observacao: string | null;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        dataInicio: Date;
        dataFim: Date;
    }>;
    negar(solicitacaoId: string, motivoDecisao: string, usuarioId: string, grupoIdSolicitante: string): Promise<{
        decididoPorUsuario: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoFolga;
        motoristaId: string;
        observacao: string | null;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        dataInicio: Date;
        dataFim: Date;
    }>;
    private buscarPendentePertencente;
}
