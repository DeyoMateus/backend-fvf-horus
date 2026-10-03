import type { SuperAdminAutenticado } from '../common/decorators/current-user.decorator';
import { CreateEmpresaMaeDto } from './dto/create-empresa-mae.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { AtualizarStatusEmpresaDto } from './dto/atualizar-status-empresa.dto';
import { UpdateUsuarioSuperAdminDto } from './dto/update-usuario-super-admin.dto';
import { CreateUsuarioGrupoDto } from './dto/create-usuario-grupo.dto';
import { AtualizarStatusUsuarioEmpresaDto } from '../usuarios-empresa/dto/atualizar-status-usuario-empresa.dto';
import { SuperAdminService } from './super-admin.service';
import { AuditService } from '../common/audit/audit.service';
import { ListarAuditoriaDto } from '../auditoria/dto/listar-auditoria.dto';
export declare class SuperAdminController {
    private readonly superAdminService;
    private readonly audit;
    constructor(superAdminService: SuperAdminService, audit: AuditService);
    criarEmpresaMae(dto: CreateEmpresaMaeDto, superAdmin: SuperAdminAutenticado): Promise<{
        grupo: {
            id: string;
            razaoSocial: string;
            createdAt: Date;
        };
        empresa: {
            id: string;
            razaoSocial: string;
            cnpj: string;
            grupoId: string;
        };
        admin: {
            id: string;
            nome: string;
            email: string;
            papel: import("@prisma/client").PapelUsuario;
            ativo: boolean;
            createdAt: Date;
        };
    }>;
    listarGrupos(): Promise<{
        id: string;
        razaoSocial: string;
        createdAt: Date;
        totalEmpresas: number;
        totalUsuarios: number;
        totalMotoristas: number;
    }[]>;
    obterGrupo(id: string): Promise<{
        id: string;
        razaoSocial: string;
        createdAt: Date;
        empresas: {
            id: string;
            razaoSocial: string;
            cnpj: string;
            ativo: boolean;
            registroInpiAfd: string | null;
            totalMotoristas: number;
        }[];
        usuarios: {
            id: string;
            createdAt: Date;
            nome: string;
            email: string;
            papel: import("@prisma/client").$Enums.PapelUsuario;
            ativo: boolean;
        }[];
    }>;
    atualizarGrupo(id: string, dto: UpdateGrupoDto, superAdmin: SuperAdminAutenticado): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        razaoSocial: string;
    }>;
    atualizarEmpresa(id: string, dto: UpdateEmpresaDto, superAdmin: SuperAdminAutenticado): Promise<{
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
    atualizarStatusEmpresa(id: string, dto: AtualizarStatusEmpresaDto, superAdmin: SuperAdminAutenticado): Promise<{
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
    atualizarUsuario(id: string, dto: UpdateUsuarioSuperAdminDto, superAdmin: SuperAdminAutenticado): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
    }>;
    criarUsuarioParaGrupo(grupoId: string, dto: CreateUsuarioGrupoDto, superAdmin: SuperAdminAutenticado): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
        telefoneWhatsapp: string | null;
    }>;
    atualizarStatusUsuarioGrupo(grupoId: string, usuarioId: string, dto: AtualizarStatusUsuarioEmpresaDto, superAdmin: SuperAdminAutenticado): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
        telefoneWhatsapp: string | null;
    }>;
    listarAuditoria(filtro: ListarAuditoriaDto): Promise<{
        dados: ({
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
        } & {
            actorNome: string | null;
        })[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    listarOcorrenciasAuditoria(grupoId?: string): Promise<{
        acao: string;
        entidade: string;
    }[]>;
}
