"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateService = void 0;
const common_1 = require("@nestjs/common");
const forge = __importStar(require("node-forge"));
const crypto_1 = require("crypto");
const envelope_encryption_service_1 = require("../crypto/envelope-encryption.service");
let CertificateService = class CertificateService {
    crypto;
    constructor(crypto) {
        this.crypto = crypto;
    }
    senhaPfx(id) {
        return this.crypto.deriveKey(`pfx-passphrase:${id}`).toString('hex');
    }
    gerarParaMotorista(input) {
        return this.gerarCertificado(input.id, [
            { name: 'commonName', value: input.nome },
            { name: 'organizationalUnitName', value: `CPF:${input.cpf}` },
            {
                name: 'organizationName',
                value: `FVF Horus - CNPJ ${input.empresaCnpj}`,
            },
            { name: 'countryName', value: 'BR' },
        ]);
    }
    gerarCertificado(id, atributos) {
        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();
        cert.publicKey = keys.publicKey;
        cert.serialNumber = (0, crypto_1.createHash)('sha1')
            .update(id)
            .digest('hex')
            .slice(0, 16);
        const validoDesde = new Date();
        const validoAte = new Date(validoDesde);
        validoAte.setFullYear(validoAte.getFullYear() + 3);
        cert.validity.notBefore = validoDesde;
        cert.validity.notAfter = validoAte;
        cert.setSubject(atributos);
        cert.setIssuer(atributos);
        cert.setExtensions([
            { name: 'basicConstraints', cA: false },
            {
                name: 'keyUsage',
                digitalSignature: true,
                nonRepudiation: true,
                keyEncipherment: false,
            },
            { name: 'extKeyUsage', clientAuth: true },
        ]);
        cert.sign(keys.privateKey, forge.md.sha256.create());
        const pfxAsn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], this.senhaPfx(id), {
            algorithm: '3des',
        });
        const pfxDer = forge.asn1.toDer(pfxAsn1).getBytes();
        const pfxBuffer = Buffer.from(pfxDer, 'binary');
        const certDer = forge.asn1
            .toDer(forge.pki.certificateToAsn1(cert))
            .getBytes();
        const fingerprint = (0, crypto_1.createHash)('sha256')
            .update(Buffer.from(certDer, 'binary'))
            .digest('hex');
        return { pfxBuffer, fingerprint, validoAte };
    }
    decodificar(id, pfxBuffer) {
        const senha = this.senhaPfx(id);
        const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);
        const keyBags = p12.getBags({
            bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
        });
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
        const certBag = certBags[forge.pki.oids.certBag]?.[0];
        if (!keyBag?.key || !certBag?.cert) {
            throw new Error('Não foi possível extrair chave/certificado do PFX');
        }
        const certDer = forge.asn1
            .toDer(forge.pki.certificateToAsn1(certBag.cert))
            .getBytes();
        const fingerprint = (0, crypto_1.createHash)('sha256')
            .update(Buffer.from(certDer, 'binary'))
            .digest('hex');
        return {
            privateKey: keyBag.key,
            certificadoPem: forge.pki.certificateToPem(certBag.cert),
            fingerprint,
        };
    }
};
exports.CertificateService = CertificateService;
exports.CertificateService = CertificateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [envelope_encryption_service_1.EnvelopeEncryptionService])
], CertificateService);
//# sourceMappingURL=certificate.service.js.map