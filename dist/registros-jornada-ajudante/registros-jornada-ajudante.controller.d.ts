import { CreateRegistroJornadaAjudanteDto } from './dto/create-registro-jornada-ajudante.dto';
import { RegistrosJornadaAjudanteService } from './registros-jornada-ajudante.service';
export declare class RegistrosJornadaAjudanteController {
    private readonly registrosService;
    constructor(registrosService: RegistrosJornadaAjudanteService);
    create(req: {
        ajudante: {
            id: string;
        };
        deviceUuid: string;
    }, dto: CreateRegistroJornadaAjudanteDto, ip: string, userAgent?: string): Promise<{
        id: string;
        createdAt: Date;
        observacao: string | null;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        precisaoGpsM: number | null;
        sequencial: number;
        hashAnterior: string;
        hashAtual: string;
        assinaturaDigital: string | null;
        algoritmoAssinatura: string;
        deviceUuidUsado: string;
        idempotencyKey: string | null;
        ajudanteId: string;
    }>;
    meuHistorico(req: {
        ajudante: {
            id: string;
        };
    }): Promise<{
        id: string;
        createdAt: Date;
        observacao: string | null;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        precisaoGpsM: number | null;
        sequencial: number;
        hashAnterior: string;
        hashAtual: string;
        assinaturaDigital: string | null;
        algoritmoAssinatura: string;
        deviceUuidUsado: string;
        idempotencyKey: string | null;
        ajudanteId: string;
    }[]>;
}
