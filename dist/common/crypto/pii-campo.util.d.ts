export declare const PREFIXO_PII = "enc:v1:";
export declare const CAMPOS_PII: readonly ["cpf", "cnh", "telefone"];
type CampoPii = (typeof CAMPOS_PII)[number];
export declare function reiniciarChavesPii(): void;
export declare function criptografiaPiiLigada(): boolean;
export declare function estaCifrado(valor: unknown): valor is string;
export declare function cifrarCampo(campo: CampoPii, valor: string): string;
export declare function decifrarCampo(campo: CampoPii, valor: string): string;
export declare function revelarPii<T>(valor: T): T;
export declare function cifrarFiltroPii(where: unknown): unknown;
export declare function cifrarDadosPii<T>(data: T): T;
export declare function cifrarArgumentosPii(operacao: string, args: unknown[]): unknown[];
export declare function protegerDadosPii<T>(data: T): T;
export declare function condicaoBuscaCpf(termo: string): {
    cpf: {
        contains: string;
    };
} | {
    cpf: string;
} | null;
export {};
