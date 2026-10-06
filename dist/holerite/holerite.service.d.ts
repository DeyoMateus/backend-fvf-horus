import type { Motorista } from '@prisma/client';
import type { EmpresaDoComprovante } from '../common/comprovante/comprovante.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
export interface EventoDetalhadoHolerite {
    timestampEvento: Date;
    tipoEvento: string;
    origemGestor: boolean;
    detalhe: string | null;
    latitude: number | null;
    longitude: number | null;
    fusoOffsetMin: number;
}
export interface DiaHolerite {
    dia: string;
    direcaoMin: number;
    esperaMin: number;
    normalMin: number;
    extraMin: number;
    noturnoMin: number;
    indefinidoMin: number;
    teveFechamentoGestor: boolean;
}
export interface OpcoesHolerite {
    direcaoEspera: boolean;
    normalExtra: boolean;
    adicionalNoturno: boolean;
}
export interface ResultadoHolerite {
    motoristaId: string;
    periodoInicio: Date;
    periodoFim: Date;
    opcoes: OpcoesHolerite;
    dias: DiaHolerite[];
    eventos: EventoDetalhadoHolerite[];
    fusoEmpresaOffsetMin: number;
    totais: {
        direcaoMin: number;
        esperaMin: number;
        normalMin: number;
        extraMin: number;
        noturnoMin: number;
        indefinidoMin: number;
    };
    regraSindicalAplicada: {
        id: string;
        nome: string;
    } | null;
}
export declare class HoleriteService {
    private readonly prisma;
    private readonly tenant;
    constructor(prisma: PrismaService, tenant: TenantService);
    calcular(motoristaId: string, dataInicio: Date, dataFim: Date, opcoes: OpcoesHolerite, grupoIdSolicitante: string): Promise<ResultadoHolerite>;
    calcularEmLote(motoristaIds: string[] | null | undefined, dataInicio: Date, dataFim: Date, opcoes: OpcoesHolerite, grupoIdSolicitante: string): Promise<Array<{
        motorista: Pick<Motorista, 'id' | 'nome' | 'cpf' | 'cnh'>;
        empresa: EmpresaDoComprovante;
        resultado: ResultadoHolerite;
    }>>;
    private montarLinhaDoTempoFuso;
    private unificarEventos;
    private construirEventosDetalhados;
    private calcularIntervalos;
    private calcularIntervalosIndefinido;
    private agruparPorDia;
}
