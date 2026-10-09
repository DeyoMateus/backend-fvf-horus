import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { AtualizarLimitesEsperaDto } from './dto/atualizar-limites-espera.dto';
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
    obterLimitesEspera(user: UsuarioAutenticado): Promise<{
        infoMin: number;
        atencaoMin: number;
        criticoMin: number;
        padrao: import("../common/jornada-legal/jornada-legal.service").LimitesEspera;
    }>;
    atualizarLimitesEspera(dto: AtualizarLimitesEsperaDto, user: UsuarioAutenticado): Promise<{
        infoMin: number;
        atencaoMin: number;
        criticoMin: number;
        padrao: import("../common/jornada-legal/jornada-legal.service").LimitesEspera;
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
