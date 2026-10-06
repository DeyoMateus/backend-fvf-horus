export interface RegistroParaHash {
    motoristaId: string;
    tipoEvento: string;
    timestampEvento: Date | string;
    latitude?: number | string | null;
    longitude?: number | string | null;
    precisaoGpsM?: number | null;
    odometro?: number | null;
    observacao?: string | null;
    sequencial: number;
    deviceUuidUsado: string;
    fusoOffsetMin?: number | null;
}
export declare class HashChainService {
    gerarHashGenesis(input: {
        empresaId: string;
        cpf: string;
        cnh: string;
    }): string;
    private paraNumero;
    canonicalizar(payload: RegistroParaHash): string;
    calcularHash(hashAnterior: string, sequencial: number, payload: RegistroParaHash): string;
    sha256(valor: string | Buffer): string;
    verificarCadeia(hashGenesis: string, registros: Array<{
        sequencial: number;
        hashAnterior: string;
        hashAtual: string;
        motoristaId: string;
        tipoEvento: string;
        timestampEvento: Date;
        latitude: unknown;
        longitude: unknown;
        precisaoGpsM: number | null;
        odometro: number | null;
        observacao: string | null;
        deviceUuidUsado: string;
        fusoOffsetMin?: number | null;
    }>): {
        valido: boolean;
        totalRegistros: number;
        primeiraQuebraSequencial?: number;
        motivo?: string;
        quebras: Array<{
            sequencial: number;
            motivo: string;
        }>;
    };
}
