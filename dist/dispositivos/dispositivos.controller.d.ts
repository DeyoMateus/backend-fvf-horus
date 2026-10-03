import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { DispositivosService } from './dispositivos.service';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
export declare class DispositivosController {
    private readonly dispositivosService;
    constructor(dispositivosService: DispositivosService);
    vincular(motoristaId: string, dto: VincularDispositivoDto, user: UsuarioAutenticado): Promise<{
        motoristaId: string;
        deviceUuid: string;
        vinculadoEm: Date;
        deviceApiKey: string;
    }>;
    status(motoristaId: string, user: UsuarioAutenticado): Promise<{
        deviceUuid: string;
        vinculadoPorUsuarioId: string;
        vinculadoEm: Date;
        atualizadoEm: Date;
    } | {
        vinculado: boolean;
    }>;
    revogar(motoristaId: string, user: UsuarioAutenticado): Promise<void>;
}
