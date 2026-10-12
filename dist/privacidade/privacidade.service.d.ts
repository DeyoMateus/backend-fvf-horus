import { Prisma, StatusSolicitacaoTitular, TipoDocumentoPrivacidade, TipoSolicitacaoTitular } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AtualizarEncarregadoDto, ResponderSolicitacaoTitularDto } from './dto/privacidade.dto';
export interface FiltroSolicitacoesTitular {
    status?: StatusSolicitacaoTitular;
    tipo?: TipoSolicitacaoTitular;
    busca?: string;
    dataInicio?: Date;
    dataFim?: Date;
    vencidas?: boolean;
    ordem?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
}
export declare class PrivacidadeService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    documentosPublicos(): {
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
    obterParaMotorista(motoristaId: string): Promise<{
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
    registrarAceite(motoristaId: string, tipoDocumento: TipoDocumentoPrivacidade, versao: string, ip?: string | null): Promise<{
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
    criarSolicitacao(motoristaId: string, tipo: TipoSolicitacaoTitular, descricao?: string): Promise<{
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
    listarDoMotorista(motoristaId: string): Prisma.PrismaPromise<{
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
    listarParaPainel(filtro: FiltroSolicitacoesTitular): Promise<{
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
    listarPendentesParaSino(): Promise<{
        motorista: {
            nome: string;
        };
        id: string;
        createdAt: Date;
        tipo: import("@prisma/client").$Enums.TipoSolicitacaoTitular;
        prazoEm: Date;
    }[]>;
    responderSolicitacao(id: string, grupoId: string, usuarioId: string, dto: ResponderSolicitacaoTitularDto): Promise<{
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
    situacaoDasCiencias(): Promise<{
        versao: string;
        motoristas: {
            id: string;
            nome: string;
            politicaEm: Date | null;
            termoGpsEm: Date | null;
            termoDadosEm: Date | null;
        }[];
    }>;
    obterEncarregado(grupoId: string): Promise<{
        id: string;
        cnpj: string;
        razaoSocial: string;
        encarregadoNome: string | null;
        encarregadoEmail: string | null;
        encarregadoTelefone: string | null;
    }[]>;
    atualizarEncarregado(grupoId: string, usuarioId: string, dto: AtualizarEncarregadoDto): Promise<{
        id: string;
        cnpj: string;
        razaoSocial: string;
        encarregadoNome: string | null;
        encarregadoEmail: string | null;
        encarregadoTelefone: string | null;
    }[]>;
    exportarDadosDoMotorista(motoristaId: string): Promise<{
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
            latitude: Prisma.Decimal | null;
            longitude: Prisma.Decimal | null;
            precisaoGpsM: number | null;
        }[];
        amostrasDeLocalizacao: {
            latitude: Prisma.Decimal;
            longitude: Prisma.Decimal;
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
