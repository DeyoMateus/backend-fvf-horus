export declare function nomeArquivoSeguro(nome: string | undefined | null): string;
export declare function contentDispositionAnexo(nome: string): string;
export interface TipoImagemDetectado {
    mime: string;
    extensao: string;
}
export declare function detectarTipoImagem(buffer: Buffer | undefined | null): TipoImagemDetectado | null;
export declare function nomeComExtensaoDoTipo(nome: string | undefined | null, tipo: TipoImagemDetectado): string;
export declare const MENSAGEM_SO_IMAGEM = "S\u00F3 \u00E9 poss\u00EDvel anexar IMAGENS (JPG, PNG, WEBP ou HEIC/HEIF, o formato das fotos do iPhone). PDF e outros arquivos n\u00E3o s\u00E3o aceitos: tire um print ou uma foto do documento e anexe a imagem.";
