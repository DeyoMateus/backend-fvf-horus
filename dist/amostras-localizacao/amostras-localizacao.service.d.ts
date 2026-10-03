import { PrismaService } from '../common/prisma/prisma.service';
import { AmostraLocalizacaoItemDto } from './dto/create-amostras-localizacao.dto';
export declare class AmostrasLocalizacaoService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    registrarLote(motoristaId: string, amostras: AmostraLocalizacaoItemDto[]): Promise<{
        gravadas: number;
    }>;
}
