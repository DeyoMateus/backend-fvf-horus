import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { LocalizacaoAcessoService } from '../common/localizacao/localizacao-acesso.service';
import { GerarHoleriteQueryDto } from './dto/gerar-holerite.dto';
import { HoleriteService } from './holerite.service';
export declare class HoleriteController {
    private readonly holeriteService;
    private readonly prisma;
    private readonly localizacao;
    constructor(holeriteService: HoleriteService, prisma: PrismaService, localizacao: LocalizacaoAcessoService);
    calcular(motoristaId: string, query: GerarHoleriteQueryDto, user: UsuarioAutenticado, ip: string, userAgent?: string): Promise<import("./holerite.service").ResultadoHolerite>;
    baixarPdf(motoristaId: string, query: GerarHoleriteQueryDto, user: UsuarioAutenticado, res: Response, ip: string): Promise<void>;
}
