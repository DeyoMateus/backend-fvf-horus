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
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let StorageService = class StorageService {
    static { StorageService_1 = this; }
    logger = new common_1.Logger(StorageService_1.name);
    endpoint;
    bucket;
    accessKeyId;
    secretAccessKey;
    host;
    static REGIAO = 'auto';
    static SERVICO = 's3';
    constructor() {
        this.endpoint = process.env.R2_ENDPOINT;
        this.bucket = process.env.R2_BUCKET;
        this.accessKeyId = process.env.R2_ACCESS_KEY_ID;
        this.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
        if (this.endpoint) {
            this.host = new URL(this.endpoint).host;
        }
    }
    configurado() {
        return !!(this.endpoint &&
            this.bucket &&
            this.accessKeyId &&
            this.secretAccessKey &&
            this.host);
    }
    async subirObjeto(chave, buffer, contentType) {
        this.exigirConfigurado();
        const caminho = `/${this.bucket}/${StorageService_1.codificarCaminho(chave)}`;
        const payloadHash = (0, crypto_1.createHash)('sha256').update(buffer).digest('hex');
        const headers = this.assinar('PUT', caminho, payloadHash, {
            'content-type': contentType,
        });
        const resposta = await fetch(`${this.endpoint}${caminho}`, {
            method: 'PUT',
            headers: { ...headers, 'content-type': contentType },
            body: new Uint8Array(buffer),
        });
        if (!resposta.ok) {
            const corpo = await resposta.text().catch(() => '');
            throw new Error(`R2 PUT "${chave}" respondeu ${resposta.status}: ${corpo}`);
        }
    }
    async baixarObjeto(chave) {
        this.exigirConfigurado();
        const caminho = `/${this.bucket}/${StorageService_1.codificarCaminho(chave)}`;
        const payloadHashVazio = (0, crypto_1.createHash)('sha256').update('').digest('hex');
        const headers = this.assinar('GET', caminho, payloadHashVazio, {});
        const resposta = await fetch(`${this.endpoint}${caminho}`, {
            method: 'GET',
            headers,
        });
        if (!resposta.ok) {
            const corpo = await resposta.text().catch(() => '');
            throw new Error(`R2 GET "${chave}" respondeu ${resposta.status}: ${corpo}`);
        }
        const arrayBuffer = await resposta.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
    async excluirObjeto(chave) {
        this.exigirConfigurado();
        const caminho = `/${this.bucket}/${StorageService_1.codificarCaminho(chave)}`;
        const payloadHashVazio = (0, crypto_1.createHash)('sha256').update('').digest('hex');
        const headers = this.assinar('DELETE', caminho, payloadHashVazio, {});
        const resposta = await fetch(`${this.endpoint}${caminho}`, {
            method: 'DELETE',
            headers,
        });
        if (!resposta.ok && resposta.status !== 404) {
            const corpo = await resposta.text().catch(() => '');
            throw new Error(`R2 DELETE "${chave}" respondeu ${resposta.status}: ${corpo}`);
        }
    }
    logFalhaUpload(chave, erro) {
        this.logger.warn(`Falha ao subir objeto "${chave}" pro R2: ${erro.message}`);
    }
    exigirConfigurado() {
        if (!this.configurado())
            throw new Error('Storage R2 não configurado (faltam variáveis R2_* no .env)');
    }
    static codificarCaminho(chave) {
        return chave.split('/').map(encodeURIComponent).join('/');
    }
    assinar(metodo, caminho, payloadHash, extras) {
        const agora = new Date();
        const amzDate = agora.toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dataStamp = amzDate.slice(0, 8);
        const cabecalhosParaAssinar = {
            host: this.host,
            'x-amz-content-sha256': payloadHash,
            'x-amz-date': amzDate,
        };
        const nomesOrdenados = Object.keys(cabecalhosParaAssinar).sort();
        const cabecalhosCanonicos = nomesOrdenados
            .map((nome) => `${nome}:${cabecalhosParaAssinar[nome]}\n`)
            .join('');
        const cabecalhosAssinados = nomesOrdenados.join(';');
        const requisicaoCanonica = [
            metodo,
            caminho,
            '',
            cabecalhosCanonicos,
            cabecalhosAssinados,
            payloadHash,
        ].join('\n');
        const escopoCredencial = `${dataStamp}/${StorageService_1.REGIAO}/${StorageService_1.SERVICO}/aws4_request`;
        const stringParaAssinar = [
            'AWS4-HMAC-SHA256',
            amzDate,
            escopoCredencial,
            (0, crypto_1.createHash)('sha256').update(requisicaoCanonica).digest('hex'),
        ].join('\n');
        const hmac = (chave, dado) => (0, crypto_1.createHmac)('sha256', chave).update(dado).digest();
        const kData = hmac(`AWS4${this.secretAccessKey}`, dataStamp);
        const kRegiao = hmac(kData, StorageService_1.REGIAO);
        const kServico = hmac(kRegiao, StorageService_1.SERVICO);
        const kAssinatura = hmac(kServico, 'aws4_request');
        const assinatura = hmac(kAssinatura, stringParaAssinar).toString('hex');
        const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${escopoCredencial}, SignedHeaders=${cabecalhosAssinados}, Signature=${assinatura}`;
        return {
            host: this.host,
            'x-amz-content-sha256': payloadHash,
            'x-amz-date': amzDate,
            authorization,
            ...extras,
        };
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], StorageService);
//# sourceMappingURL=storage.service.js.map