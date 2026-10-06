export declare const OFFSET_PADRAO_MIN = -180;
export declare const OFFSET_BRT_MS: number;
export declare const DIA_MS: number;
export declare const OFFSET_MIN_BRASIL = -300;
export declare const OFFSET_MAX_BRASIL = -120;
export declare const FUSOS_EMPRESA_PERMITIDOS: string[];
export declare function offsetPadraoDaEmpresa(fusoHorario?: string | null): number;
export declare function offsetValido(valor: unknown): valor is number;
export declare function offsetEstimadoPorLongitude(longitude: number): number;
export interface FusoResolvido {
    offsetMin: number | null;
    divergenteDoGps: boolean;
    informadoPeloAparelho: number | null;
}
export declare function resolverFusoDoRegistro(informado: unknown, latitude?: number | null, longitude?: number | null): FusoResolvido;
export declare function paraParedeBrt(data: Date, offsetMin?: number): Date;
export declare function chaveDiaBrt(data: Date, offsetMin?: number): string;
export declare function inicioDoDiaBrt(data: Date, offsetMin?: number): Date;
export declare function proximaMeiaNoiteBrt(data: Date, offsetMin?: number): Date;
export declare function ehDataSoCalendario(data: Date): boolean;
export declare function inicioDePeriodoBrt(data: Date, offsetMin?: number): Date;
export declare function fimDePeriodoBrt(data: Date, offsetMin?: number): Date;
export declare function rotuloFuso(offsetMin: number): string;
export declare function formatarDataHoraBrt(data: Date, offsetMin?: number): string;
export declare function marcarHorario(data: Date | string): string;
export declare function renderizarHorarios(texto: string, offsetMin?: number): string;
export interface PontoFuso {
    desde: number;
    offsetMin: number;
}
export interface RegistroParaFuso {
    t: number;
    offsetMin: number | null;
}
export interface AmostraParaFuso {
    t: number;
    longitude: number;
}
export declare function construirLinhaDoTempoFuso(registros: RegistroParaFuso[], amostras: AmostraParaFuso[], padraoMin?: number): PontoFuso[];
export declare function offsetNoInstante(linha: PontoFuso[], t: number, padraoMin?: number): number;
export interface PedacoDeTempo {
    inicio: Date;
    fim: Date;
    offsetMin: number;
}
export declare function dividirPorDiaCivil(inicio: Date, fim: Date, linha: PontoFuso[], padraoMin?: number): PedacoDeTempo[];
export declare function minutosNoturnosEntre(inicio: Date, fim: Date, offsetMin: number, inicioNoturnoHora?: number, fimNoturnoHora?: number): number;
