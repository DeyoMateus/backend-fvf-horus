import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { DecidirSolicitacaoDto } from './dto/decidir-solicitacao.dto';
import { SolicitacoesAjustePontoService } from './solicitacoes-ajuste-ponto.service';
export declare class SolicitacoesAjustePontoPorMotoristaController {
    private readonly solicitacoesService;
    constructor(solicitacoesService: SolicitacoesAjustePontoService);
    list(motoristaId: string, user: UsuarioAutenticado): Promise<({
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
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoAjuste;
        registroReferenciaId: string | null;
        justificativa: string;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        tratamentoPontoId: string | null;
    })[]>;
}
export declare class SolicitacoesAjustePontoGeralController {
    private readonly solicitacoesService;
    constructor(solicitacoesService: SolicitacoesAjustePontoService);
    pendentes(user: UsuarioAutenticado): Promise<({
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
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoAjuste;
        registroReferenciaId: string | null;
        justificativa: string;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        tratamentoPontoId: string | null;
    })[]>;
    historico(user: UsuarioAutenticado, page?: string, pageSize?: string, ordem?: 'asc' | 'desc'): Promise<{
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
            motoristaId: string;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            createdAt: Date;
            status: import("@prisma/client").$Enums.StatusSolicitacaoAjuste;
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
    aprovar(id: string, dto: DecidirSolicitacaoDto, user: UsuarioAutenticado): Promise<{
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
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoAjuste;
        registroReferenciaId: string | null;
        justificativa: string;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        tratamentoPontoId: string | null;
    }>;
    rejeitar(id: string, dto: DecidirSolicitacaoDto, user: UsuarioAutenticado): Promise<{
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
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        createdAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoAjuste;
        registroReferenciaId: string | null;
        justificativa: string;
        decididoPorUsuarioId: string | null;
        decididoEm: Date | null;
        motivoDecisao: string | null;
        tratamentoPontoId: string | null;
    }>;
    baixarEvidencia(evidenciaId: string, user: UsuarioAutenticado, res: Response): Promise<void>;
    removerEvidencia(evidenciaId: string, user: UsuarioAutenticado): Promise<{
        ok: boolean;
    }>;
}
