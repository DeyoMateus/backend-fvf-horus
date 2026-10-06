import type { Response } from 'express';
import { CreateSolicitacaoAjusteDto } from './dto/create-solicitacao-ajuste.dto';
import { SolicitacoesAjustePontoService } from './solicitacoes-ajuste-ponto.service';
export declare class SolicitacoesAjustePontoMobileController {
    private readonly solicitacoesService;
    constructor(solicitacoesService: SolicitacoesAjustePontoService);
    criar(req: {
        motorista: {
            id: string;
        };
    }, dto: CreateSolicitacaoAjusteDto): Promise<{
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
    listarMinhas(req: {
        motorista: {
            id: string;
        };
    }): Promise<({
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
    anexarEvidencia(solicitacaoId: string, arquivo: Express.Multer.File | undefined, req: {
        motorista: {
            id: string;
        };
    }): Promise<{
        id: string;
        nomeArquivo: string;
        contentType: string;
        tamanhoBytes: number;
    }>;
    baixarEvidencia(evidenciaId: string, req: {
        motorista: {
            id: string;
        };
    }, res: Response): Promise<void>;
    removerEvidencia(evidenciaId: string, req: {
        motorista: {
            id: string;
        };
    }): Promise<{
        ok: boolean;
    }>;
}
