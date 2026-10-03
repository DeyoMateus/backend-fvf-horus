"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HashChainService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let HashChainService = class HashChainService {
    gerarHashGenesis(input) {
        const nonce = (0, crypto_1.randomBytes)(16).toString('hex');
        return this.sha256(`GENESIS|${input.empresaId}|${input.cpf}|${input.cnh}|${nonce}|${Date.now()}`);
    }
    paraNumero(valor) {
        if (valor === null || valor === undefined)
            return null;
        const n = Number(valor);
        return Number.isNaN(n) ? null : n;
    }
    canonicalizar(payload) {
        const ordenado = {
            latitude: this.paraNumero(payload.latitude),
            longitude: this.paraNumero(payload.longitude),
            motoristaId: payload.motoristaId,
            deviceUuidUsado: payload.deviceUuidUsado,
            observacao: payload.observacao ?? null,
            odometro: payload.odometro ?? null,
            precisaoGpsM: payload.precisaoGpsM ?? null,
            sequencial: payload.sequencial,
            timestampEvento: new Date(payload.timestampEvento).toISOString(),
            tipoEvento: payload.tipoEvento,
        };
        return JSON.stringify(ordenado);
    }
    calcularHash(hashAnterior, sequencial, payload) {
        const canonico = this.canonicalizar(payload);
        return this.sha256(`${hashAnterior}|${sequencial}|${canonico}`);
    }
    sha256(valor) {
        return (0, crypto_1.createHash)('sha256').update(valor).digest('hex');
    }
    verificarCadeia(hashGenesis, registros) {
        const ordenados = [...registros].sort((a, b) => a.sequencial - b.sequencial);
        let hashEsperado = hashGenesis;
        const quebras = [];
        for (const registro of ordenados) {
            if (registro.hashAnterior !== hashEsperado) {
                quebras.push({
                    sequencial: registro.sequencial,
                    motivo: 'hashAnterior não corresponde ao hash do evento anterior (possível remoção/inserção)',
                });
                hashEsperado = registro.hashAtual;
                continue;
            }
            const hashRecalculado = this.calcularHash(registro.hashAnterior, registro.sequencial, {
                motoristaId: registro.motoristaId,
                tipoEvento: registro.tipoEvento,
                timestampEvento: registro.timestampEvento,
                latitude: registro.latitude,
                longitude: registro.longitude,
                precisaoGpsM: registro.precisaoGpsM,
                odometro: registro.odometro,
                observacao: registro.observacao,
                sequencial: registro.sequencial,
                deviceUuidUsado: registro.deviceUuidUsado,
            });
            if (hashRecalculado !== registro.hashAtual) {
                quebras.push({
                    sequencial: registro.sequencial,
                    motivo: 'hashAtual não corresponde ao recálculo (evento foi alterado)',
                });
            }
            hashEsperado = registro.hashAtual;
        }
        return {
            valido: quebras.length === 0,
            totalRegistros: ordenados.length,
            primeiraQuebraSequencial: quebras[0]?.sequencial,
            motivo: quebras[0]?.motivo,
            quebras,
        };
    }
};
exports.HashChainService = HashChainService;
exports.HashChainService = HashChainService = __decorate([
    (0, common_1.Injectable)()
], HashChainService);
//# sourceMappingURL=hash-chain.service.js.map