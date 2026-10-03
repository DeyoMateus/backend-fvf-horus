import { PapelUsuario } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEmpresaMaeDto } from './dto/create-empresa-mae.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { UpdateUsuarioSuperAdminDto } from './dto/update-usuario-super-admin.dto';
import { CreateUsuarioGrupoDto } from './dto/create-usuario-grupo.dto';
import { AtualizarStatusUsuarioEmpresaDto } from '../usuarios-empresa/dto/atualizar-status-usuario-empresa.dto';
export declare class SuperAdminService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    criarEmpresaMae(dto: CreateEmpresaMaeDto, superAdminId: string): Promise<{
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
            papel: PapelUsuario;
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
    obterGrupo(grupoId: string): Promise<{
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
    atualizarGrupo(grupoId: string, dto: UpdateGrupoDto, superAdminId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        razaoSocial: string;
    }>;
    atualizarEmpresa(empresaId: string, dto: UpdateEmpresaDto, superAdminId: string): Promise<{
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
    atualizarStatusEmpresa(empresaId: string, ativo: boolean, superAdminId: string): Promise<{
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
    atualizarUsuario(usuarioId: string, dto: UpdateUsuarioSuperAdminDto, superAdminId: string): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
    }>;
    criarUsuarioParaGrupo(grupoId: string, dto: CreateUsuarioGrupoDto, superAdminId: string): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
        telefoneWhatsapp: string | null;
    }>;
    atualizarStatusUsuarioGrupo(grupoId: string, usuarioId: string, dto: AtualizarStatusUsuarioEmpresaDto, superAdminId: string): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
        telefoneWhatsapp: string | null;
    }>;
}
