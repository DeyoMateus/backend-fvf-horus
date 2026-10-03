import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface EnvelopeCiphertext {
    ciphertext: Buffer;
    iv: string;
    authTag: string;
}
export declare class EnvelopeEncryptionService implements OnModuleInit {
    private readonly config;
    private readonly logger;
    private masterKey;
    constructor(config: ConfigService);
    onModuleInit(): void;
    deriveKey(context: string): Buffer;
    encrypt(plaintext: Buffer, aad: string): EnvelopeCiphertext;
    decrypt(ciphertext: Buffer, ivHex: string, authTagHex: string, aad: string): Buffer;
}
