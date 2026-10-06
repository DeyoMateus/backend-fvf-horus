import { AuditService } from '../common/audit/audit.service';
import { PushNotificationsService } from '../common/notifications/push-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { TenantService } from '../common/tenant/tenant.service';
import { TratamentosPontoService } from '../tratamentos-ponto/tratamentos-ponto.service';
import { CreateSolicitacaoAjusteDto } from './dto/create-solicitacao-ajuste.dto';
export declare class SolicitacoesAjustePontoService {
    private readonly prisma;
    private readonly audit;
    private readonly tenant;
    private readonly storage;
    private readonly push;
    private readonly tratamentosPontoService;
    constructor(prisma: PrismaService, audit: AuditService, tenant: TenantService, storage: StorageService, push: PushNotificationsService, tratamentosPontoService: TratamentosPontoService);
    criar(motoristaId: string, dto: CreateSolicitacaoAjusteDto): Promise<{
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoAjuste;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        registroReferenciaId: string | null;
        justificativa: string;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        tratamentoPontoId: string | null;
    }>;
    listarMinhas(motoristaId: string): Promise<({
        registroReferencia: {
            id: string;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            sequencial: number;
        } | null;
        evidencias: {
            id: string;
            createdAt: Date;
            nomeArquivo: string;
            contentType: string;
            tamanhoBytes: number;
        }[];
        decididoPorUsuario: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoAjuste;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        registroReferenciaId: string | null;
        justificativa: string;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        tratamentoPontoId: string | null;
    })[]>;
    anexarEvidenciaDoMotorista(solicitacaoId: string, motoristaId: string, arquivo: Express.Multer.File): Promise<{
        id: string;
        nomeArquivo: string;
        contentType: string;
        tamanhoBytes: number;
    }>;
    removerEvidenciaDoMotorista(evidenciaId: string, motoristaId: string): Promise<void>;
    baixarEvidenciaDoMotorista(evidenciaId: string, motoristaId: string): Promise<{
        conteudo: Buffer<ArrayBufferLike>;
        id: string;
        createdAt: Date;
        solicitacaoId: string;
        nomeArquivo: string;
        contentType: string;
        tamanhoBytes: number;
        chaveStorage: string | null;
    }>;
    listarPorMotorista(motoristaId: string, grupoIdSolicitante: string): Promise<({
        registroReferencia: {
            id: string;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            sequencial: number;
        } | null;
        evidencias: {
            id: string;
            createdAt: Date;
            nomeArquivo: string;
            contentType: string;
            tamanhoBytes: number;
        }[];
        decididoPorUsuario: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoAjuste;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        registroReferenciaId: string | null;
        justificativa: string;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        tratamentoPontoId: string | null;
    })[]>;
    listarPendentesDoGrupo(grupoIdSolicitante: string): Promise<({
        motorista: {
            id: string;
            nome: string;
        };
        registroReferencia: {
            id: string;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            sequencial: number;
        } | null;
        evidencias: {
            id: string;
            createdAt: Date;
            nomeArquivo: string;
            contentType: string;
            tamanhoBytes: number;
        }[];
        decididoPorUsuario: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoAjuste;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        registroReferenciaId: string | null;
        justificativa: string;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        tratamentoPontoId: string | null;
    })[]>;
    listarHistoricoDoGrupo(grupoIdSolicitante: string, page?: number, pageSize?: number, ordem?: 'asc' | 'desc'): Promise<{
        dados: ({
            motorista: {
                id: string;
                nome: string;
            };
            registroReferencia: {
                id: string;
                tipoEvento: import("@prisma/client").$Enums.TipoEvento;
                timestampEvento: Date;
                sequencial: number;
            } | null;
            evidencias: {
                id: string;
                createdAt: Date;
                nomeArquivo: string;
                contentType: string;
                tamanhoBytes: number;
            }[];
            decididoPorUsuario: {
                id: string;
                nome: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.StatusSolicitacaoAjuste;
            motoristaId: string;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            registroReferenciaId: string | null;
            justificativa: string;
            decididoPorUsuarioId: string | null;
            decididoEm: Date | null;
            motivoDecisao: string | null;
            tratamentoPontoId: string | null;
        })[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    aprovar(solicitacaoId: string, motivoDecisao: string | undefined, usuarioId: string, grupoIdSolicitante: string): Promise<{
        registroReferencia: {
            id: string;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            sequencial: number;
        } | null;
        evidencias: {
            id: string;
            createdAt: Date;
            nomeArquivo: string;
            contentType: string;
            tamanhoBytes: number;
        }[];
        decididoPorUsuario: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoAjuste;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        registroReferenciaId: string | null;
        justificativa: string;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        tratamentoPontoId: string | null;
    }>;
    rejeitar(solicitacaoId: string, motivoDecisao: string, usuarioId: string, grupoIdSolicitante: string): Promise<{
        registroReferencia: {
            id: string;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            sequencial: number;
        } | null;
        evidencias: {
            id: string;
            createdAt: Date;
            nomeArquivo: string;
            contentType: string;
            tamanhoBytes: number;
        }[];
        decididoPorUsuario: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoAjuste;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        registroReferenciaId: string | null;
        justificativa: string;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        tratamentoPontoId: string | null;
    }>;
    baixarEvidenciaDoPainel(evidenciaId: string, grupoIdSolicitante: string): Promise<{
        conteudo: Buffer<ArrayBufferLike>;
        id: string;
        createdAt: Date;
        solicitacaoId: string;
        nomeArquivo: string;
        contentType: string;
        tamanhoBytes: number;
        chaveStorage: string | null;
    }>;
    removerEvidenciaDoPainel(evidenciaId: string, grupoIdSolicitante: string): Promise<void>;
    private buscarPendentePertencente;
    private anexarEvidencia;
    private removerEvidencia;
    private baixarEvidencia;
}
