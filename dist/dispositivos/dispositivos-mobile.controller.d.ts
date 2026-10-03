import { RelogioConfiavelService } from '../common/relogio-confiavel/relogio-confiavel.service';
import { AtualizarPushTokenDto } from './dto/atualizar-push-token.dto';
import { SincronizarRelogioDto } from './dto/sincronizar-relogio.dto';
import { DispositivosService } from './dispositivos.service';
export declare class DispositivosMobileController {
    private readonly dispositivosService;
    private readonly relogioConfiavel;
    constructor(dispositivosService: DispositivosService, relogioConfiavel: RelogioConfiavelService);
    atualizarMeuPushToken(req: {
        motorista: {
            id: string;
        };
    }, dto: AtualizarPushTokenDto): Promise<void>;
    sincronizarRelogio(req: {
        motorista: {
            id: string;
        };
        deviceUuid: string;
    }, dto: SincronizarRelogioDto): Promise<{
        horaServidor: string;
    }>;
}
