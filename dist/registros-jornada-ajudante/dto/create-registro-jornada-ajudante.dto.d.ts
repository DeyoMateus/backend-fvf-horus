import { TipoEvento } from '@prisma/client';
export declare const TIPOS_EVENTO_AJUDANTE: readonly ["INICIO_JORNADA", "INICIO_DESCANSO", "FIM_DESCANSO", "FIM_JORNADA"];
export declare class CreateRegistroJornadaAjudanteDto {
    tipoEvento: TipoEvento;
    timestampEvento: string;
    latitude?: number;
    longitude?: number;
    precisaoGpsM?: number;
    observacao?: string;
    idempotencyKey?: string;
}
