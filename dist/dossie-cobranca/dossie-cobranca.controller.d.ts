import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { ListarDossieCobrancaDto } from './dto/listar-dossie-cobranca.dto';
import { DossieCobrancaService } from './dossie-cobranca.service';
export declare class DossieCobrancaController {
    private readonly dossieService;
    private readonly prisma;
    constructor(dossieService: DossieCobrancaService, prisma: PrismaService);
    listar(user: UsuarioAutenticado, query: ListarDossieCobrancaDto): Promise<import("./dossie-cobranca.service").ItemDossieCobranca[]>;
    pdf(user: UsuarioAutenticado, query: ListarDossieCobrancaDto, res: Response): Promise<void>;
}
