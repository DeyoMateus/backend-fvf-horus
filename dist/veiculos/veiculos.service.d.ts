import { ActorType } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { AtualizarVeiculoDto } from './dto/atualizar-veiculo.dto';
export declare class VeiculosService {
    private readonly prisma;
    private readonly audit;
    private readonly tenant;
    constructor(prisma: PrismaService, audit: AuditService, tenant: TenantService);
    atualizar(motoristaId: string, dto: AtualizarVeiculoDto, ator: {
        tipo: ActorType;
        id: string | null;
    }, grupoIdSolicitante?: string): Promise<{
        id: string;
        motoristaId: string;
        atualizadoEm: Date;
        criadoEm: Date;
        placa: string;
        idRastreador: string | null;
        tecnologiaRastreador: import("@prisma/client").$Enums.TecnologiaRastreador | null;
        atualizadoPorTipo: import("@prisma/client").$Enums.ActorType;
        atualizadoPorId: string | null;
    }>;
    status(motoristaId: string, grupoIdSolicitante?: string): Promise<{
        id: string;
        motoristaId: string;
        atualizadoEm: Date;
        criadoEm: Date;
        placa: string;
        idRastreador: string | null;
        tecnologiaRastreador: import("@prisma/client").$Enums.TecnologiaRastreador | null;
        atualizadoPorTipo: import("@prisma/client").$Enums.ActorType;
        atualizadoPorId: string | null;
    } | {
        vinculado: boolean;
    }>;
    listarTrocas(motoristaId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        actorType: import("@prisma/client").$Enums.ActorType;
        actorId: string | null;
        acao: string;
        entidade: string;
        entidadeId: string | null;
        detalhes: import("@prisma/client/runtime/library").JsonValue | null;
        ip: string | null;
        userAgent: string | null;
        createdAt: Date;
        grupoId: string | null;
    }[]>;
}
