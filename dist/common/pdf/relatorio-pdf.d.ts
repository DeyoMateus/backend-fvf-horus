export declare const COR_TEXTO = "#111827";
export declare const COR_SUAVE = "#6b7280";
export declare const COR_LINHA = "#d1d5db";
export declare const COR_CABECALHO = "#1f2937";
export declare const COR_FAIXA = "#f3f4f6";
export declare const COR_DESTAQUE_ALERTA = "#b91c1c";
export declare const MARGEM_PDF = 48;
export interface ColunaPdf {
    titulo: string;
    largura: number;
    alinhamento?: 'left' | 'right' | 'center';
}
export interface OpcoesRelatorioPdf {
    titulo: string;
    assunto?: string;
    rodape: string;
    autor?: string;
}
export interface CabecalhoPdf {
    titulo: string;
    subtitulo?: string;
    campos?: Array<[string, string]>;
    aviso?: string;
}
export declare class RelatorioPdf {
    readonly doc: PDFKit.PDFDocument;
    readonly esquerda: number;
    readonly largura: number;
    private readonly chunks;
    private readonly pronto;
    private readonly textoRodape;
    constructor(opcoes: OpcoesRelatorioPdf);
    limiteY(): number;
    garantirEspaco(altura: number): void;
    cabecalho(c: CabecalhoPdf): void;
    secao(titulo: string, subtitulo?: string): void;
    subsecao(titulo: string, apoio?: string): void;
    nota(texto: string, opcoes?: {
        justificar?: boolean;
    }): void;
    paragrafo(texto: string): void;
    vazio(msg: string): void;
    separador(): void;
    camposChaveValor(pares: Array<[string, string]>, larguraRotulo?: number): void;
    tabela(colunas: ColunaPdf[], linhas: string[][], opcoes?: {
        tamanhoFonte?: number;
        ultimaLinhaTotal?: boolean;
        links?: Array<Array<string | undefined>>;
    }): void;
    static limitar<T>(itens: T[], max: number, complemento?: string): {
        itens: T[];
        nota: string | null;
    };
    finalizar(): Promise<Buffer>;
}
