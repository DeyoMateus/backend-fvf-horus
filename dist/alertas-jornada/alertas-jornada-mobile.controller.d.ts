import { AlertasJornadaService } from './alertas-jornada.service';
export declare class AlertasJornadaMobileController {
    private readonly alertasService;
    constructor(alertasService: AlertasJornadaService);
    listarMeusAlertas(req: {
        motorista: {
            id: string;
        };
    }, naoVisualizados?: string): Promise<{
        id: string;
        detalhes: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        motoristaId: string;
        tipo: import("@prisma/client").$Enums.TipoAlertaJornada;
        severidade: import("@prisma/client").$Enums.SeveridadeAlerta;
        mensagem: string;
        janelaInicio: Date;
        janelaFim: Date;
        minutosAcumulados: number;
        registroGeradorId: string;
        visualizadoEm: Date | null;
        visualizadoPorUsuarioId: string | null;
        motoristaVisualizadoEm: Date | null;
        tratadoEm: Date | null;
        tratadoPorUsuarioId: string | null;
        tratamentoObservacao: string | null;
    }[]>;
    marcarVisualizado(alertaId: string, req: {
        motorista: {
            id: string;
        };
    }): Promise<{
        id: string;
        detalhes: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        motoristaId: string;
        tipo: import("@prisma/client").$Enums.TipoAlertaJornada;
        severidade: import("@prisma/client").$Enums.SeveridadeAlerta;
        mensagem: string;
        janelaInicio: Date;
        janelaFim: Date;
        minutosAcumulados: number;
        registroGeradorId: string;
        visualizadoEm: Date | null;
        visualizadoPorUsuarioId: string | null;
        motoristaVisualizadoEm: Date | null;
        tratadoEm: Date | null;
        tratadoPorUsuarioId: string | null;
        tratamentoObservacao: string | null;
    }>;
}
