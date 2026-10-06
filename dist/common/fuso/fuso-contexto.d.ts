export declare function executarComFusoDoCliente<T>(offsetMin: number, fn: () => T): T;
export declare function offsetDoCliente(): number;
export declare function agoraDoCliente(): string;
export declare function instanteDoCliente(data: Date): string;
export declare function instanteDoEvento(data: Date, offsetEventoMin?: number | null): string;
