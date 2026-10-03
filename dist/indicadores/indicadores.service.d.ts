import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { HoleriteService } from '../holerite/holerite.service';
import { BancoHorasService } from '../banco-horas/banco-horas.service';
export interface IndicadoresAlertas {
    total: number;
    criticos: number;
    atencao: number;
    info: number;
    riscoFraude: number;
}
export interface IndicadoresBancoHoras {
    ativo: boolean;
    creditoExtraMin: number;
    creditoCorrecaoMin: number;
    debitoMin: number;
    saldoMin: number;
}
export interface IndicadoresMotorista {
    motoristaId: string;
    nome: string;
    direcaoMin: number;
    esperaMin: number;
    normalMin: number;
    extraMin: number;
    noturnoMin: number;
    indefinidoMin: number;
    alertas: IndicadoresAlertas;
    percentualExtraSobreDirecao: number;
    percentualEsperaSobreTotal: number;
    percentualNoturnoSobreDirecao: number;
    percentualIndefinidoSobreJornada: number;
    bancoHoras: IndicadoresBancoHoras;
}
export interface IndicadoresDiaTendencia {
    dia: string;
    direcaoMin: number;
    esperaMin: number;
    normalMin: number;
    extraMin: number;
    noturnoMin: number;
    indefinidoMin: number;
    alertas: number;
    bancoHorasCreditoMin: number;
    bancoHorasDebitoMin: number;
    bancoHorasSaldoAcumuladoMin: number;
}
export interface IndicadoresRankingItem {
    motoristaId: string;
    nome: string;
    valorMin: number;
}
export interface IndicadoresPainel {
    periodoInicio: string;
    periodoFim: string;
    motoristaFiltro: string | null;
    motoristas: IndicadoresMotorista[];
    totais: {
        direcaoMin: number;
        esperaMin: number;
        normalMin: number;
        extraMin: number;
        noturnoMin: number;
        indefinidoMin: number;
        alertas: IndicadoresAlertas;
        percentualExtraSobreDirecao: number;
        percentualEsperaSobreTotal: number;
        percentualNoturnoSobreDirecao: number;
        percentualIndefinidoSobreJornada: number;
        bancoHoras: IndicadoresBancoHoras;
    };
    motoristasComBancoHorasAtivo: number;
    tendenciaDiaria: IndicadoresDiaTendencia[];
    rankingHorasExtras: IndicadoresRankingItem[];
    rankingTempoEspera: IndicadoresRankingItem[];
    rankingTempoIndefinido: IndicadoresRankingItem[];
}
export declare class IndicadoresService {
    private readonly prisma;
    private readonly tenant;
    private readonly holerite;
    private readonly bancoHoras;
    constructor(prisma: PrismaService, tenant: TenantService, holerite: HoleriteService, bancoHoras: BancoHorasService);
    painel(grupoId: string, dataInicio: Date, dataFim: Date, motoristaId?: string): Promise<IndicadoresPainel>;
    exportarCsv(grupoId: string, dataInicio: Date, dataFim: Date, motoristaId?: string): Promise<string>;
}
