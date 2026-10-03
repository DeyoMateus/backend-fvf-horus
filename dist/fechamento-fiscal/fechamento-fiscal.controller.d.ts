import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { FechamentoFiscalQueryDto } from './dto/fechamento-fiscal.dto';
import { FechamentoFiscalService } from './fechamento-fiscal.service';
export declare class FechamentoFiscalController {
    private readonly fechamentoFiscalService;
    constructor(fechamentoFiscalService: FechamentoFiscalService);
    espelhosRepPPdf(user: UsuarioAutenticado, query: FechamentoFiscalQueryDto, res: Response): Promise<void>;
}
