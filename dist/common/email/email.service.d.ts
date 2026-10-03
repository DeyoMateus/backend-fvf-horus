export declare class EmailService {
    private readonly logger;
    configurado(): boolean;
    enviar(destinatario: string, assunto: string, corpoHtml: string): Promise<void>;
    private enviarViaProvedor;
}
