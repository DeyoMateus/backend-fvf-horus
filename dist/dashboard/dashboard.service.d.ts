import { TipoAlertaJornada } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
export declare const TIPOS_ALERTA_RISCO_FRAUDE: TipoAlertaJornada[];
export type ChaveIndicadorTendencia = 'registros' | 'alertasCritico' | 'alertasAtencao' | 'alertasInfo' | 'riscoFraude' | 'horasDirecao' | 'horasEspera' | 'horasIndefinido';
export type CardPainel = 'ativos' | 'em-direcao' | 'em-descanso' | 'em-espera' | 'jornada-aberta-sem-sub-evento' | 'sem-jornada-aberta' | 'sem-nenhum-registro' | 'alertas-criticos' | 'alertas-atencao' | 'alertas-24h' | 'risco-fraude-7d';
export declare class DashboardService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    resumo(grupoId: string): Promise<{
        atualizadoEm: string;
        fusoHorario: string;
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
    detalheCard(grupoId: string, card: CardPainel): Promise<{
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
    private mapearAlertas;
    tendencia(grupoId: string, opts: {
        dias?: number;
        desde?: string;
        ate?: string;
        fusoOffsetMin?: number;
    }): Promise<{
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
    tendenciaDetalhe(grupoId: string, dia: string, indicador: ChaveIndicadorTendencia, fusoOffsetMin?: number): Promise<{
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
    private estadoAtualPorMotorista;
    private jornadasEmAbertoComInicio;
    private direcaoContinuaPorMotorista;
    private descreverDirecaoContinua;
    private formatarHorasMinutos;
}
