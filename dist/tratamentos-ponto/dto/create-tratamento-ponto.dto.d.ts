import { TipoEvento } from '@prisma/client';
export declare class CreateTratamentoPontoDto {
    tipoEvento: TipoEvento;
    timestampEvento: string;
    motivo: string;
    registroReferenciaId?: string;
    fusoOffsetMin?: number;
}
