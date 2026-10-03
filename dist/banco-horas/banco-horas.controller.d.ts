import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { BancoHorasService } from './banco-horas.service';
import { CriarAjusteBancoHorasDto } from './dto/criar-ajuste-banco-horas.dto';
import { SaldoBancoHorasQueryDto } from './dto/saldo-banco-horas-query.dto';
export declare class BancoHorasController {
    private readonly bancoHorasService;
    constructor(bancoHorasService: BancoHorasService);
    saldo(motoristaId: string, query: SaldoBancoHorasQueryDto, user: UsuarioAutenticado): Promise<import("./banco-horas.service").SaldoBancoHoras>;
    ajustes(motoristaId: string, user: UsuarioAutenticado): Promise<({
        registradoPorUsuario: {
            nome: string;
            email: string;
        };
    } & {
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        tipo: import("@prisma/client").$Enums.TipoAjusteBancoHoras;
        observacao: string | null;
        minutos: number;
        registradoPorUsuarioId: string;
    })[]>;
    registrarAjuste(motoristaId: string, dto: CriarAjusteBancoHorasDto, user: UsuarioAutenticado): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        tipo: import("@prisma/client").$Enums.TipoAjusteBancoHoras;
        observacao: string | null;
        minutos: number;
        registradoPorUsuarioId: string;
    }>;
}
