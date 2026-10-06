import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { CreateTratamentoPontoDto } from './dto/create-tratamento-ponto.dto';
import { TratamentosPontoService } from './tratamentos-ponto.service';
export declare class TratamentosPontoController {
    private readonly tratamentosService;
    constructor(tratamentosService: TratamentosPontoService);
    create(motoristaId: string, dto: CreateTratamentoPontoDto, user: UsuarioAutenticado): Promise<{
        id: string;
        createdAt: Date;
        fusoOffsetMin: number | null;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        usuarioId: string;
        motivo: string;
        registroReferenciaId: string | null;
        hashReferencia: string;
        hashRegistro: string;
        motoristaCienciaEm: Date | null;
    }>;
    contexto(motoristaId: string, timestamp: string, user: UsuarioAutenticado): Promise<{
        permitidos: string[];
    }>;
    list(motoristaId: string, user: UsuarioAutenticado): Promise<({
        usuario: {
            id: string;
            nome: string;
            email: string;
        };
        evidencias: {
            id: string;
            createdAt: Date;
            nomeArquivo: string;
            contentType: string;
            tamanhoBytes: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        fusoOffsetMin: number | null;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        usuarioId: string;
        motivo: string;
        registroReferenciaId: string | null;
        hashReferencia: string;
        hashRegistro: string;
        motoristaCienciaEm: Date | null;
    })[]>;
    anexarEvidencia(tratamentoId: string, arquivo: Express.Multer.File | undefined, user: UsuarioAutenticado): Promise<{
        id: string;
        nomeArquivo: string;
        contentType: string;
        tamanhoBytes: number;
    }>;
    baixarEvidencia(evidenciaId: string, res: Response, user: UsuarioAutenticado): Promise<void>;
    removerEvidencia(evidenciaId: string, user: UsuarioAutenticado): Promise<{
        ok: boolean;
    }>;
}
