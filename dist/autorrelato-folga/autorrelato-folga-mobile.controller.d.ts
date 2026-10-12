import { AutorrelatoFolgaService } from './autorrelato-folga.service';
import { CreateAutorrelatoFolgaDto } from './dto/create-autorrelato-folga.dto';
export declare class AutorrelatoFolgaMobileController {
    private readonly service;
    constructor(service: AutorrelatoFolgaService);
    autorrelatar(_req: {
        motorista: {
            id: string;
        };
    }, _dto: CreateAutorrelatoFolgaDto): never;
    listarMinhas(req: {
        motorista: {
            id: string;
        };
    }): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        observacao: string | null;
    }[]>;
    anular(req: {
        motorista: {
            id: string;
        };
    }, data: string): Promise<{
        anulada: boolean;
    }>;
}
