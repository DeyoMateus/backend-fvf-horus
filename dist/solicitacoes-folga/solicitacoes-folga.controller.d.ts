import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { DecidirSolicitacaoFolgaDto } from './dto/decidir-solicitacao-folga.dto';
import { SolicitacoesFolgaService } from './solicitacoes-folga.service';
export declare class SolicitacoesFolgaPorMotoristaController {
    private readonly service;
    constructor(service: SolicitacoesFolgaService);
    list(motoristaId: string, user: UsuarioAutenticado): Promise<({
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
export declare class SolicitacoesFolgaGeralController {
    private readonly service;
    constructor(service: SolicitacoesFolgaService);
    pendentes(user: UsuarioAutenticado): Promise<({
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
    contagem(user: UsuarioAutenticado): Promise<{
        total: number;
    }>;
    historico(user: UsuarioAutenticado, page?: string, pageSize?: string, ordem?: 'asc' | 'desc'): Promise<{
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
    aprovar(id: string, dto: DecidirSolicitacaoFolgaDto, user: UsuarioAutenticado): Promise<{
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
    negar(id: string, dto: DecidirSolicitacaoFolgaDto, user: UsuarioAutenticado): Promise<{
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
}
