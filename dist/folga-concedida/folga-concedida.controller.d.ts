import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { CreateFolgaConcedidaDto } from './dto/create-folga-concedida.dto';
import { FolgaConcedidaService } from './folga-concedida.service';
export declare class FolgaConcedidaController {
    private readonly folgaConcedidaService;
    constructor(folgaConcedidaService: FolgaConcedidaService);
    conceder(motoristaId: string, dto: CreateFolgaConcedidaDto, user: UsuarioAutenticado): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        motivo: string | null;
        concedidaPorUsuarioId: string;
    }>;
    listar(motoristaId: string, user: UsuarioAutenticado): Promise<({
        concedidaPorUsuario: {
            id: string;
            nome: string;
        };
    } & {
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        motivo: string | null;
        concedidaPorUsuarioId: string;
    })[]>;
}
