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
export declare class JornadaLegalService {
    avaliar(registros: RegistroJornada[], registroRecemCriado: RegistroJornada, alertasExistentesTipos: Set<TipoAlertaJornada>, agoraOverride?: Date): AlertaCalculado[];
    calcularProximoLimiar(registros: RegistroJornada[], agora: Date): {
        emMs: number;
    } | null;
    private avaliarOciosidadeDirecao;
    private distanciaHaversineMetros;
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
