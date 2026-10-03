import * as forge from 'node-forge';
export declare class SignatureService {
    assinar(privateKey: forge.pki.rsa.PrivateKey, conteudo: string): string;
    verificar(certificadoPem: string, conteudo: string, assinaturaBase64: string): boolean;
}
