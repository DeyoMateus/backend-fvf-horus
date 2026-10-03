import { PrismaService } from '../common/prisma/prisma.service';
import { RegistrosJornadaService } from '../registros-jornada/registros-jornada.service';
import { RepPService } from '../common/rep-p/rep-p.service';
import { FeriadosService } from '../feriados/feriados.service';
export declare class FechamentoFiscalService {
    private readonly prisma;
    private readonly registrosJornada;
    private readonly repP;
    private readonly feriados;
    constructor(prisma: PrismaService, registrosJornada: RegistrosJornadaService, repP: RepPService, feriados: FeriadosService);
    gerarEspelhosRepPEmLote(grupoId: string, dataInicio: Date, dataFim: Date, motoristaIds: string[] | null): Promise<Buffer>;
    private gerarCapa;
    private mesclarPdfs;
}
