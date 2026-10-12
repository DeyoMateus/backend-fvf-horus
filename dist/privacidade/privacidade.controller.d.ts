import type { Motorista } from '@prisma/client';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { AtualizarEncarregadoDto, CriarSolicitacaoTitularDto, RegistrarAceiteDto, ResponderSolicitacaoTitularDto } from './dto/privacidade.dto';
import { PrivacidadeService } from './privacidade.service';
type RequisicaoMotorista = {
    motorista: Motorista;
    ip?: string;
};
export declare class PrivacidadePublicaController {
    private readonly service;
    constructor(service: PrivacidadeService);
    documentos(): {
        versao: string;
        controlador: {
            razaoSocial: string;
            cnpj: string;
        } | null;
        encarregado: {
            nome: string;
            email: string | null;
            telefone: string | null;
        } | null;
        documentos: {
            tipo: string;
            titulo: string;
            texto: string;
        }[];
    };
}
export declare class PrivacidadeMobileController {
    private readonly service;
    constructor(service: PrivacidadeService);
    obter(req: RequisicaoMotorista): Promise<{
        aceites: {
            [k: string]: Date | null;
        };
        pendente: boolean;
        versao: string;
        controlador: {
            razaoSocial: string;
            cnpj: string;
        } | null;
        encarregado: {
            nome: string;
            email: string | null;
            telefone: string | null;
        } | null;
        documentos: {
            tipo: string;
            titulo: string;
            texto: string;
        }[];
    }>;
    ciencia(req: RequisicaoMotorista, dto: RegistrarAceiteDto): Promise<{
        aceites: {
            [k: string]: Date | null;
        };
        pendente: boolean;
        versao: string;
        controlador: {
            razaoSocial: string;
            cnpj: string;
        } | null;
        encarregado: {
            nome: string;
            email: string | null;
            telefone: string | null;
        } | null;
        documentos: {
            tipo: string;
            titulo: string;
            texto: string;
        }[];
    }>;
    criar(req: RequisicaoMotorista, dto: CriarSolicitacaoTitularDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoTitular;
        motoristaId: string;
        tipo: import("@prisma/client").$Enums.TipoSolicitacaoTitular;
        descricao: string | null;
        resposta: string | null;
        prazoEm: Date;
        respondidaEm: Date | null;
        respondidaPorUsuarioId: string | null;
    }>;
    solicitacoes(status?: string, tipo?: string, busca?: string, dataInicio?: string, dataFim?: string, vencidas?: string, ordem?: string, page?: string, pageSize?: string): Promise<{
        dados: {
            respondidaPorNome: string | null;
            vencida: boolean;
            motorista: {
                id: string;
                nome: string;
            };
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.StatusSolicitacaoTitular;
            motoristaId: string;
            tipo: import("@prisma/client").$Enums.TipoSolicitacaoTitular;
            descricao: string | null;
            resposta: string | null;
            prazoEm: Date;
            respondidaEm: Date | null;
            respondidaPorUsuarioId: string | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
        resumo: {
            abertas: number;
            emAnalise: number;
            vencidas: number;
        };
    }>;
    pendentes(): Promise<{
        motorista: {
            nome: string;
        };
        id: string;
        createdAt: Date;
        tipo: import("@prisma/client").$Enums.TipoSolicitacaoTitular;
        prazoEm: Date;
    }[]>;
    responder(id: string, dto: ResponderSolicitacaoTitularDto, user: UsuarioAutenticado): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.StatusSolicitacaoTitular;
        motoristaId: string;
        tipo: import("@prisma/client").$Enums.TipoSolicitacaoTitular;
        descricao: string | null;
        resposta: string | null;
        prazoEm: Date;
        respondidaEm: Date | null;
        respondidaPorUsuarioId: string | null;
    }>;
    ciencias(): Promise<{
        versao: string;
        motoristas: {
            id: string;
            nome: string;
            politicaEm: Date | null;
            termoGpsEm: Date | null;
            termoDadosEm: Date | null;
        }[];
    }>;
    encarregado(user: UsuarioAutenticado): Promise<{
        id: string;
        cnpj: string;
        razaoSocial: string;
        encarregadoNome: string | null;
        encarregadoEmail: string | null;
        encarregadoTelefone: string | null;
    }[]>;
    atualizarEncarregado(dto: AtualizarEncarregadoDto, user: UsuarioAutenticado): Promise<{
        id: string;
        cnpj: string;
        razaoSocial: string;
        encarregadoNome: string | null;
        encarregadoEmail: string | null;
        encarregadoTelefone: string | null;
    }[]>;
}
export {};
