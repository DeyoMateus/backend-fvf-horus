import { TipoEvento } from '@prisma/client';
export interface EventoLinhaDoTempo {
    tipoEvento: TipoEvento;
    timestampEvento: Date;
}
export interface ResultadoValidacaoAjuste {
    ok: boolean;
    mensagem?: string;
    permitidos: TipoEvento[];
}
export declare function validarSequenciaAjuste(tipo: TipoEvento, anteriores: EventoLinhaDoTempo[], posteriores: EventoLinhaDoTempo[]): ResultadoValidacaoAjuste;
