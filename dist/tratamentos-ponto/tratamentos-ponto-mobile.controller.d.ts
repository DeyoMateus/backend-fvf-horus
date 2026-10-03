import type { Response } from 'express';
import { TratamentosPontoService } from './tratamentos-ponto.service';
export declare class TratamentosPontoMobileController {
    private readonly tratamentosService;
    constructor(tratamentosService: TratamentosPontoService);
    listarMeusAjustes(req: {
        motorista: {
            id: string;
        };
    }): Promise<({
        usuario: {
            nome: string;
        };
        evidencias: {
            id: string;
            nomeArquivo: string;
            contentType: string;
            tamanhoBytes: number;
        }[];
    } & {
        id: string;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        createdAt: Date;
        motivo: string;
        usuarioId: string;
        registroReferenciaId: string | null;
        hashReferencia: string;
        hashRegistro: string;
        motoristaCienciaEm: Date | null;
    })[]>;
    darCiencia(tratamentoId: string, req: {
        motorista: {
            id: string;
        };
    }): Promise<{
        id: string;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        createdAt: Date;
        motivo: string;
        usuarioId: string;
        registroReferenciaId: string | null;
        hashReferencia: string;
        hashRegistro: string;
        motoristaCienciaEm: Date | null;
    }>;
    baixarEvidencia(evidenciaId: string, req: {
        motorista: {
            id: string;
        };
    }, res: Response): Promise<void>;
}
