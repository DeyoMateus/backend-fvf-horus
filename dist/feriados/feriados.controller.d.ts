import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { CreateFeriadoDto } from './dto/create-feriado.dto';
import { UpdateFeriadoDto } from './dto/update-feriado.dto';
import { FeriadosService } from './feriados.service';
export declare class FeriadosController {
    private readonly feriadosService;
    constructor(feriadosService: FeriadosService);
    create(dto: CreateFeriadoDto, user: UsuarioAutenticado): Promise<{
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
    list(user: UsuarioAutenticado): import("@prisma/client").Prisma.PrismaPromise<({
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
    findOne(id: string, user: UsuarioAutenticado): Promise<{
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
    update(id: string, dto: UpdateFeriadoDto, user: UsuarioAutenticado): Promise<{
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
    desativar(id: string, user: UsuarioAutenticado): Promise<{
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
}
