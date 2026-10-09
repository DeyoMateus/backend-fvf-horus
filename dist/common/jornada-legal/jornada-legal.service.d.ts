import { RegistroJornada, SeveridadeAlerta, TipoAlertaJornada } from '@prisma/client';
interface AlertaCalculado {
    tipo: TipoAlertaJornada;
    severidade: SeveridadeAlerta;
    mensagem: string;
    janelaInicio: Date;
    janelaFim: Date;
    minutosAcumulados: number;
    detalhes?: Record<string, unknown>;
}
export interface LimitesEspera {
    infoMin: number;
    atencaoMin: number;
    criticoMin: number;
}
export declare const LIMITES_ESPERA_PADRAO: LimitesEspera;
export declare class JornadaLegalService {
    avaliar(registros: RegistroJornada[], registroRecemCriado: RegistroJornada, alertasExistentesTipos: Set<TipoAlertaJornada>, agoraOverride?: Date, limitesEspera?: LimitesEspera): AlertaCalculado[];
    calcularProximoLimiar(registros: RegistroJornada[], agora: Date, limitesEspera?: LimitesEspera): {
        emMs: number;
    } | null;
    private avaliarOciosidadeDirecao;
    private distanciaHaversineMetros;
    inicioDaDirecaoContinua(registros: RegistroJornada[], agora: Date): Date | null;
    private calcularAcumuladosDirecao;
    private avaliarDescansoInterjornada;
    private recortarJornadaCorrente;
    private construirIntervalos;
    private avaliarTempoIndefinido;
    private minutosEntre;
    private formatarHoras;
    private somarMinutos;
}
export type { AlertaCalculado };
