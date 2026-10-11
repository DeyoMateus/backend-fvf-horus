import { TipoEvento } from '@prisma/client';
export declare class EventoJornadaTratamentoDto {
    tipoEvento: TipoEvento;
    timestampEvento: string;
}
export declare class CreateJornadaTratamentoDto {
    eventos: EventoJornadaTratamentoDto[];
    motivo: string;
    fusoOffsetMin?: number;
}
