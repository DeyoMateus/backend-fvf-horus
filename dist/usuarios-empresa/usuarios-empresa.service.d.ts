import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateUsuarioEmpresaDto } from './dto/create-usuario-empresa.dto';
import { AtualizarStatusUsuarioEmpresaDto } from './dto/atualizar-status-usuario-empresa.dto';
import { UpdatePerfilProprioDto } from './dto/update-perfil-proprio.dto';
export declare class UsuariosEmpresaService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    create(dto: CreateUsuarioEmpresaDto, grupoId: string, actorId: string): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
        telefoneWhatsapp: string | null;
        telefoneGerenciamentoRisco: string | null;
    }>;
    list(grupoIdSolicitante: string): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
        telefoneWhatsapp: string | null;
        telefoneGerenciamentoRisco: string | null;
    }[]>;
    atualizarStatus(id: string, dto: AtualizarStatusUsuarioEmpresaDto, grupoIdSolicitante: string, actorId: string): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
        telefoneWhatsapp: string | null;
        telefoneGerenciamentoRisco: string | null;
    }>;
    obterMeuPerfil(usuarioId: string): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
        telefoneWhatsapp: string | null;
        telefoneGerenciamentoRisco: string | null;
    }>;
    atualizarMeuPerfil(usuarioId: string, dto: UpdatePerfilProprioDto): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
        telefoneWhatsapp: string | null;
        telefoneGerenciamentoRisco: string | null;
    }>;
}
