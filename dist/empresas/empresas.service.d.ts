import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
export declare class EmpresasService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    create(dto: CreateEmpresaDto, grupoId: string, actorId?: string): Promise<{
        id: string;
        createdAt: Date;
        grupoId: string;
        ativo: boolean;
        updatedAt: Date;
        cnpj: string;
        razaoSocial: string;
        registroInpiAfd: string | null;
        regraSindicalId: string | null;
    }>;
    findById(id: string, grupoIdSolicitante: string): Promise<{
        id: string;
        createdAt: Date;
        grupoId: string;
        ativo: boolean;
        updatedAt: Date;
        cnpj: string;
        razaoSocial: string;
        registroInpiAfd: string | null;
        regraSindicalId: string | null;
    }>;
    list(grupoIdSolicitante: string): import("@prisma/client").Prisma.PrismaPromise<({
        regraSindical: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        grupoId: string;
        ativo: boolean;
        updatedAt: Date;
        cnpj: string;
        razaoSocial: string;
        registroInpiAfd: string | null;
        regraSindicalId: string | null;
    })[]>;
    vincularRegraSindical(empresaId: string, regraSindicalId: string | null, grupoIdSolicitante: string, actorId?: string): Promise<{
        regraSindical: {
            id: string;
            nome: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        grupoId: string;
        ativo: boolean;
        updatedAt: Date;
        cnpj: string;
        razaoSocial: string;
        registroInpiAfd: string | null;
        regraSindicalId: string | null;
    }>;
}
