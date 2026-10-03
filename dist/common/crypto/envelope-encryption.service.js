"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EnvelopeEncryptionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvelopeEncryptionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
let EnvelopeEncryptionService = EnvelopeEncryptionService_1 = class EnvelopeEncryptionService {
    config;
    logger = new common_1.Logger(EnvelopeEncryptionService_1.name);
    masterKey;
    constructor(config) {
        this.config = config;
    }
    onModuleInit() {
        const hex = this.config.get('CRYPTO_MASTER_KEY');
        if (!hex || hex.length !== 64) {
            throw new common_1.InternalServerErrorException('CRYPTO_MASTER_KEY ausente ou inválida: defina 64 caracteres hex (32 bytes) no .env');
        }
        this.masterKey = Buffer.from(hex, 'hex');
        this.logger.log('Chave mestra de criptografia carregada (envelope encryption ativo)');
    }
    deriveKey(context) {
        const derived = (0, crypto_1.hkdfSync)('sha256', this.masterKey, Buffer.alloc(0), Buffer.from(context, 'utf8'), 32);
        return Buffer.from(derived);
    }
    encrypt(plaintext, aad) {
        const key = this.deriveKey(`envelope:${aad}`);
        const iv = (0, crypto_1.randomBytes)(12);
        const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', key, iv);
        cipher.setAAD(Buffer.from(aad, 'utf8'));
        const ciphertext = Buffer.concat([
            cipher.update(plaintext),
            cipher.final(),
        ]);
        const authTag = cipher.getAuthTag();
        return {
            ciphertext,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
        };
    }
    decrypt(ciphertext, ivHex, authTagHex, aad) {
        const key = this.deriveKey(`envelope:${aad}`);
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
        decipher.setAAD(Buffer.from(aad, 'utf8'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    }
};
exports.EnvelopeEncryptionService = EnvelopeEncryptionService;
exports.EnvelopeEncryptionService = EnvelopeEncryptionService = EnvelopeEncryptionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EnvelopeEncryptionService);
//# sourceMappingURL=envelope-encryption.service.js.map