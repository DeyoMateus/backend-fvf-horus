import { StatusSolicitacaoTitular } from '@prisma/client';
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
    listar(req: RequisicaoMotorista): import("@prisma/client").Prisma.PrismaPromise<{
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
    }[]>;
    meusDados(req: RequisicaoMotorista): Promise<{
        geradoEm: string;
        aviso: string;
        cadastro: {
            cpf: string;
            cnh: string;
            telefone: string | null;
            empresa: {
                cnpj: string;
                razaoSocial: string;
            };
            createdAt: Date;
            nome: string;
            status: import("@prisma/client").$Enums.StatusMotorista;
        } | null;
        registrosDeJornada: {
            createdAt: Date;
            fusoOffsetMin: number | null;
            observacao: string | null;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            latitude: import("@prisma/client/runtime/library").Decimal | null;
            longitude: import("@prisma/client/runtime/library").Decimal | null;
            precisaoGpsM: number | null;
        }[];
        amostrasDeLocalizacao: {
            latitude: import("@prisma/client/runtime/library").Decimal;
            longitude: import("@prisma/client/runtime/library").Decimal;
            precisaoGpsM: number | null;
            capturadoEm: Date;
        }[];
        ajustesDePonto: {
            id: string;
            createdAt: Date;
            fusoOffsetMin: number | null;
            motoristaId: string;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            usuarioId: string;
            motivo: string;
            registroReferenciaId: string | null;
            hashReferencia: string;
            hashRegistro: string;
            motoristaCienciaEm: Date | null;
        }[];
        solicitacoesDeAjuste: {
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
        }[];
        alertas: {
            createdAt: Date;
            tipo: import("@prisma/client").$Enums.TipoAlertaJornada;
            severidade: import("@prisma/client").$Enums.SeveridadeAlerta;
            mensagem: string;
        }[];
        cienciasDePrivacidade: {
            id: string;
            motoristaId: string;
            versao: string;
            aceitoEm: Date;
            tipoDocumento: import("@prisma/client").$Enums.TipoDocumentoPrivacidade;
        }[];
        pedidosDoTitular: {
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
    }>;
}
export declare class PrivacidadePainelController {
    private readonly service;
    constructor(service: PrivacidadeService);
    solicitacoes(status?: StatusSolicitacaoTitular): Promise<{
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
    }[]>;
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
