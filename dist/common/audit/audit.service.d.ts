import { ActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export interface RegistrarAuditoriaInput {
    actorType: ActorType;
    actorId?: string | null;
    acao: string;
    entidade: string;
    entidadeId?: string | null;
    detalhes?: Record<string, unknown> | null;
    ip?: string | null;
    userAgent?: string | null;
    grupoId?: string | null;
}
export interface FiltroAuditoria {
    page?: number;
    pageSize?: number;
    actorType?: ActorType;
    excluirActorTypes?: ActorType[];
    acoes?: string[];
    entidade?: string;
    entidadeId?: string;
    dataInicio?: Date;
    dataFim?: Date;
    ordem?: 'asc' | 'desc';
}
export declare class AuditService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    registrar(input: RegistrarAuditoriaInput): Promise<void>;
    private resolverGrupoId;
    listar(filtro: FiltroAuditoria, grupoId: string | null): Promise<{
        dados: ({
            id: string;
            actorType: import("@prisma/client").$Enums.ActorType;
            actorId: string | null;
            acao: string;
            entidade: string;
            entidadeId: string | null;
            detalhes: Prisma.JsonValue | null;
            ip: string | null;
            userAgent: string | null;
            createdAt: Date;
            grupoId: string | null;
        } & {
            actorNome: string | null;
        })[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    private resolverNomesDosAtores;
    listarTiposOcorridos(grupoId: string | null): Promise<{
        acao: string;
        entidade: string;
    }[]>;
}
