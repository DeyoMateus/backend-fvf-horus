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
export declare class AntifraudeService {
    avaliar(historico: RegistroJornada[], registroRecemCriado: RegistroJornada, horaRecebimentoServidor: Date, flagsIntegridadeDispositivo: string[] | undefined, tiposExistentes: Set<TipoAlertaJornada>): AlertaCalculado[];
    private avaliarVelocidadeImpossivel;
    private avaliarRelogioDispositivo;
    private avaliarSincronizacaoTardiaSuspeita;
    private avaliarRitmoBatidasSuspeito;
    private alertaIntegridadeDispositivo;
    private formatarHoras;
    private minutosEntre;
    private distanciaHaversineMetros;
}
export {};
