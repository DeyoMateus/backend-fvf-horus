export interface ArquivoParaZip {
    nome: string;
    conteudo: Buffer;
}
export declare function criarZip(arquivos: ArquivoParaZip[]): Buffer;
