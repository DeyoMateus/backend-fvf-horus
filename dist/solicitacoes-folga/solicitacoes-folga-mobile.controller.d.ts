import { CreateSolicitacaoFolgaDto } from './dto/create-solicitacao-folga.dto';
import { SolicitacoesFolgaService } from './solicitacoes-folga.service';
export declare class SolicitacoesFolgaMobileController {
    private readonly service;
    constructor(service: SolicitacoesFolgaService);
    criar(req: {
        motorista: {
            id: string;
        };
    }, dto: CreateSolicitacaoFolgaDto): Promise<{
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
    listarMinhas(req: {
        motorista: {
            id: string;
        };
    }): Promise<({
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
}
