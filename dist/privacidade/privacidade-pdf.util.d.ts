type Linha = Record<string, unknown>;
export interface DadosExportadosMotorista {
    geradoEm: string;
    aviso: string;
    cadastro: Linha | null;
    registrosDeJornada: Linha[];
    amostrasDeLocalizacao: Linha[];
    ajustesDePonto: Linha[];
    solicitacoesDeAjuste: Linha[];
    alertas: Linha[];
    cienciasDePrivacidade: Linha[];
    pedidosDoTitular: Linha[];
}
export declare const LIMITE_LINHAS_PDF: {
    registros: number;
    amostras: number;
    demais: number;
};
export declare function gerarPdfMeusDados(d: DadosExportadosMotorista): Promise<Buffer>;
export {};
