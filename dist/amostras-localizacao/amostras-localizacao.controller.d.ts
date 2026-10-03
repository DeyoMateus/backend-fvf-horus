import { AmostrasLocalizacaoService } from './amostras-localizacao.service';
import { CreateAmostrasLocalizacaoDto } from './dto/create-amostras-localizacao.dto';
export declare class AmostrasLocalizacaoController {
    private readonly service;
    constructor(service: AmostrasLocalizacaoService);
    registrar(req: {
        motorista: {
            id: string;
        };
    }, dto: CreateAmostrasLocalizacaoDto): Promise<{
        gravadas: number;
    }>;
}
