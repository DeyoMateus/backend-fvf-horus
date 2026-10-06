import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { AfdService } from '../common/afd/afd.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { EmpresasService } from './empresas.service';
export declare class EmpresasController {
    private readonly empresasService;
    private readonly afdService;
    private readonly tenant;
    constructor(empresasService: EmpresasService, afdService: AfdService, tenant: TenantService);
    create(dto: CreateEmpresaDto, user: UsuarioAutenticado): Promise<{
        id: string;
        createdAt: Date;
        grupoId: string;
        ativo: boolean;
        updatedAt: Date;
        cnpj: string;
        razaoSocial: string;
        registroInpiAfd: string | null;
        fusoHorario: string;
        regraSindicalId: string | null;
    }>;
    list(user: UsuarioAutenticado): import("@prisma/client").Prisma.PrismaPromise<({
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
        fusoHorario: string;
        regraSindicalId: string | null;
    })[]>;
    afd(res: Response, user: UsuarioAutenticado, empresaId?: string, inicio?: string, fim?: string): Promise<void>;
    findOne(id: string, user: UsuarioAutenticado): Promise<{
        id: string;
        createdAt: Date;
        grupoId: string;
        ativo: boolean;
        updatedAt: Date;
        cnpj: string;
        razaoSocial: string;
        registroInpiAfd: string | null;
        fusoHorario: string;
        regraSindicalId: string | null;
    }>;
    vincularRegraSindical(id: string, regraSindicalId: string | null, user: UsuarioAutenticado): Promise<{
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
        fusoHorario: string;
        regraSindicalId: string | null;
    }>;
}
