import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { FechamentoHoleriteQueryDto } from './dto/fechamento-holerite.dto';
import { HoleriteService } from './holerite.service';
export declare class FechamentoHoleriteController {
    private readonly holeriteService;
    constructor(holeriteService: HoleriteService);
    pdf(user: UsuarioAutenticado, query: FechamentoHoleriteQueryDto, res: Response): Promise<void>;
}
