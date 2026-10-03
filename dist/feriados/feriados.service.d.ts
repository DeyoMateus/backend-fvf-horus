import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateFeriadoDto } from './dto/create-feriado.dto';
import { UpdateFeriadoDto } from './dto/update-feriado.dto';
export declare class FeriadosService {
    private readonly prisma;
    private readonly audit;
    private readonly tenant;
    constructor(prisma: PrismaService, audit: AuditService, tenant: TenantService);
    create(dto: CreateFeriadoDto, grupoId: string, actorId?: string): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        grupoId: string;
        ativo: boolean;
        updatedAt: Date;
        empresaId: string | null;
        descricao: string;
        pagoComoDomingo: boolean;
        criadoPorUsuarioId: string | null;
    }>;
    list(grupoIdSolicitante: string): import("@prisma/client").Prisma.PrismaPromise<({
        empresa: {
            id: string;
            cnpj: string;
            razaoSocial: string;
        } | null;
    } & {
        data: Date;
        id: string;
        createdAt: Date;
        grupoId: string;
        ativo: boolean;
        updatedAt: Date;
        empresaId: string | null;
        descricao: string;
        pagoComoDomingo: boolean;
        criadoPorUsuarioId: string | null;
    })[]>;
    findById(id: string, grupoIdSolicitante: string): Promise<{
        empresa: {
            id: string;
            cnpj: string;
            razaoSocial: string;
        } | null;
    } & {
        data: Date;
        id: string;
        createdAt: Date;
        grupoId: string;
        ativo: boolean;
        updatedAt: Date;
        empresaId: string | null;
        descricao: string;
        pagoComoDomingo: boolean;
        criadoPorUsuarioId: string | null;
    }>;
    update(id: string, dto: UpdateFeriadoDto, grupoIdSolicitante: string, actorId?: string): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        grupoId: string;
        ativo: boolean;
        updatedAt: Date;
        empresaId: string | null;
        descricao: string;
        pagoComoDomingo: boolean;
        criadoPorUsuarioId: string | null;
    }>;
    desativar(id: string, grupoIdSolicitante: string, actorId?: string): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        grupoId: string;
        ativo: boolean;
        updatedAt: Date;
        empresaId: string | null;
        descricao: string;
        pagoComoDomingo: boolean;
        criadoPorUsuarioId: string | null;
    }>;
    private verificarPertence;
    listarParaRelatorio(grupoId: string, empresaId: string, periodoInicio: Date, periodoFim: Date): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        grupoId: string;
        ativo: boolean;
        updatedAt: Date;
        empresaId: string | null;
        descricao: string;
        pagoComoDomingo: boolean;
        criadoPorUsuarioId: string | null;
    }[]>;
}
