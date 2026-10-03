import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { AlertasJornadaService } from './alertas-jornada.service';
import { TratarAlertaDto } from './dto/tratar-alerta.dto';
export declare class AlertasJornadaController {
    private readonly alertasService;
    constructor(alertasService: AlertasJornadaService);
    listByMotorista(motoristaId: string, user: UsuarioAutenticado, naoVisualizados?: string): Promise<{
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
    listByEmpresa(user: UsuarioAutenticado, naoVisualizados?: string): import("@prisma/client").Prisma.PrismaPromise<({
        motorista: {
            id: string;
            nome: string;
            cpf: string;
        };
    } & {
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
    })[]>;
    marcarVisualizado(alertaId: string, user: UsuarioAutenticado): Promise<{
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
    tratar(alertaId: string, dto: TratarAlertaDto, user: UsuarioAutenticado): Promise<{
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
