import * as forge from 'node-forge';
import { EnvelopeEncryptionService } from '../crypto/envelope-encryption.service';
export interface CertificadoGerado {
    pfxBuffer: Buffer;
    fingerprint: string;
    validoAte: Date;
}
export interface CertificadoDecodificado {
    privateKey: forge.pki.rsa.PrivateKey;
    certificadoPem: string;
    fingerprint: string;
}
export declare class CertificateService {
    private readonly crypto;
    constructor(crypto: EnvelopeEncryptionService);
    private senhaPfx;
    gerarParaMotorista(input: {
        id: string;
        nome: string;
        cpf: string;
        empresaCnpj: string;
    }): CertificadoGerado;
    private gerarCertificado;
    decodificar(id: string, pfxBuffer: Buffer): CertificadoDecodificado;
}
