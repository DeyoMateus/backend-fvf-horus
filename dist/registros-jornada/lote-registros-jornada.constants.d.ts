import { CreateRegistroJornadaDto } from './dto/create-registro-jornada.dto';
export declare const FILA_LOTE_REGISTROS_JORNADA = "lote-registros-jornada";
export interface JobLoteRegistroJornada {
    motoristaId: string;
    deviceUuid: string;
    eventos: CreateRegistroJornadaDto[];
    ip?: string;
    userAgent?: string;
}
export interface ResultadoItemLote {
    index: number;
    sucesso: boolean;
    registroId?: string;
    erro?: string;
}
