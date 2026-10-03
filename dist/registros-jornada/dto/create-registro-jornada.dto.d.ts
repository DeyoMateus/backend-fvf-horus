import { TipoEvento } from '@prisma/client';
export declare class CreateRegistroJornadaDto {
    tipoEvento: TipoEvento;
    timestampEvento: string;
    latitude?: number;
    longitude?: number;
    precisaoGpsM?: number;
    observacao?: string;
    idempotencyKey?: string;
    flagsIntegridadeDispositivo?: string[];
    elapsedRealtimeMs?: number;
}
