import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { GerarHoleriteQueryDto } from './dto/gerar-holerite.dto';
import { HoleriteService } from './holerite.service';
export declare class HoleriteController {
    private readonly holeriteService;
    private readonly prisma;
    constructor(holeriteService: HoleriteService, prisma: PrismaService);
    calcular(motoristaId: string, query: GerarHoleriteQueryDto, user: UsuarioAutenticado): Promise<import("./holerite.service").ResultadoHolerite>;
    baixarPdf(motoristaId: string, query: GerarHoleriteQueryDto, user: UsuarioAutenticado, res: Response): Promise<void>;
}
