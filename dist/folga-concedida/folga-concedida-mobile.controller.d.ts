import { FolgaConcedidaService } from './folga-concedida.service';
export declare class FolgaConcedidaMobileController {
    private readonly service;
    constructor(service: FolgaConcedidaService);
    listarMinhas(req: {
        motorista: {
            id: string;
        };
    }): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        motivo: string | null;
        concedidaPorUsuarioId: string;
    }[]>;
    anular(req: {
        motorista: {
            id: string;
        };
    }, data: string): Promise<{
        anulada: boolean;
    }>;
}
