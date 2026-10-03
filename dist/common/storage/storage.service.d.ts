export declare class StorageService {
    private readonly logger;
    private readonly endpoint;
    private readonly bucket;
    private readonly accessKeyId;
    private readonly secretAccessKey;
    private readonly host;
    private static readonly REGIAO;
    private static readonly SERVICO;
    constructor();
    configurado(): boolean;
    subirObjeto(chave: string, buffer: Buffer, contentType: string): Promise<void>;
    baixarObjeto(chave: string): Promise<Buffer>;
    excluirObjeto(chave: string): Promise<void>;
    logFalhaUpload(chave: string, erro: unknown): void;
    private exigirConfigurado;
    private static codificarCaminho;
    private assinar;
}
