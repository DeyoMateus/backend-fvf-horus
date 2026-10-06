import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { AtualizarStatusUsuarioEmpresaDto } from './dto/atualizar-status-usuario-empresa.dto';
import { UpdatePerfilProprioDto } from './dto/update-perfil-proprio.dto';
import { UsuariosEmpresaService } from './usuarios-empresa.service';
export declare class UsuariosEmpresaController {
    private readonly usuariosEmpresaService;
    constructor(usuariosEmpresaService: UsuariosEmpresaService);
    listar(user: UsuarioAutenticado): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
        telefoneWhatsapp: string | null;
        telefoneGerenciamentoRisco: string | null;
    }[]>;
    atualizarStatus(id: string, dto: AtualizarStatusUsuarioEmpresaDto, user: UsuarioAutenticado): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
        telefoneWhatsapp: string | null;
        telefoneGerenciamentoRisco: string | null;
    }>;
    obterMeuPerfil(user: UsuarioAutenticado): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        email: string;
        papel: import("@prisma/client").$Enums.PapelUsuario;
        ativo: boolean;
        telefoneWhatsapp: string | null;
        telefoneGerenciamentoRisco: string | null;
    }>;
    atualizarMeuPerfil(dto: UpdatePerfilProprioDto, user: UsuarioAutenticado): Promise<{
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
