import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    resumo(user: UsuarioAutenticado): Promise<{
        atualizadoEm: string;
        motoristas: {
            totalAtivos: number;
            semNenhumRegistro: number;
            emDirecao: number;
            emDescanso: number;
            emEspera: number;
            jornadaAbertaSemSubEvento: number;
            semJornadaAberta: number;
            jornadasAbertasHaMuitoTempo: {
                motoristaId: string;
                nome: string;
                desde: Date;
                horasAberta: number;
            }[];
        };
        alertas: {
            abertos: {
                CRITICO: number;
                ATENCAO: number;
                INFO: number;
            };
            totalAbertos: number;
            ultimas24h: number;
            riscoFraudeUltimos7d: number;
            topTipos7d: {
                tipo: import("@prisma/client").$Enums.TipoAlertaJornada;
                quantidade: number;
            }[];
        };
    }>;
    tendencia(user: UsuarioAutenticado, dias?: string, desde?: string, ate?: string): Promise<{
        dia: string;
        registros: number;
        alertasCritico: number;
        alertasAtencao: number;
        alertasInfo: number;
        riscoFraude: number;
        horasDirecao: number;
        horasEspera: number;
        horasIndefinido: number;
    }[]>;
    detalhe(user: UsuarioAutenticado, card: string): Promise<{
        tipo: "motoristas";
        itens: {
            motoristaId: string;
            nome: string;
            detalhe: null;
        }[];
    } | {
        tipo: "motoristas";
        itens: {
            motoristaId: string;
            nome: string;
            detalhe: string;
        }[];
    } | {
        tipo: "alertas";
        itens: {
            alertaId: string;
            motoristaId: string;
            nome: string;
            tipo: import("@prisma/client").$Enums.TipoAlertaJornada;
            severidade: import("@prisma/client").$Enums.SeveridadeAlerta;
            createdAt: Date;
        }[];
    }>;
    tendenciaDetalhe(user: UsuarioAutenticado, dia: string, indicador: string): Promise<{
        tipo: "registros";
        itens: {
            registroId: string;
            motoristaId: string;
            nome: string;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
        }[];
    } | {
        tipo: "alertas";
        itens: {
            alertaId: string;
            motoristaId: string;
            nome: string;
            tipo: import("@prisma/client").$Enums.TipoAlertaJornada;
            severidade: import("@prisma/client").$Enums.SeveridadeAlerta;
            createdAt: Date;
        }[];
    } | {
        tipo: "trechos";
        itens: {
            motoristaId: string;
            nome: string;
            inicio: Date;
            fim: Date;
            minutos: number;
        }[];
    }>;
}
