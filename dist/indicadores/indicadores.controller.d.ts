import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { IndicadoresQueryDto } from './dto/indicadores-query.dto';
import { IndicadoresService } from './indicadores.service';
export declare class IndicadoresController {
    private readonly indicadoresService;
    constructor(indicadoresService: IndicadoresService);
    painel(user: UsuarioAutenticado, query: IndicadoresQueryDto): Promise<import("./indicadores.service").IndicadoresPainel>;
    exportar(user: UsuarioAutenticado, query: IndicadoresQueryDto, res: Response): Promise<void>;
}
