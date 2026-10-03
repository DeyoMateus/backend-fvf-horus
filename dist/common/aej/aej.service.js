"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AejService = void 0;
const common_1 = require("@nestjs/common");
let AejService = class AejService {
    gerarCsv(motorista, empresa, registros) {
        const linhas = [];
        linhas.push([
            'motoristaId',
            'nomeMotorista',
            'cpf',
            'cnh',
            'empresaRazaoSocial',
            'empresaCnpj',
            'sequencial',
            'tipoEvento',
            'timestampEvento',
            'latitude',
            'longitude',
            'observacao',
            'hashAnterior',
            'hashAtual',
            'assinaturaDigital',
            'deviceUuidUsado',
        ].join(';'));
        for (const r of registros) {
            linhas.push([
                motorista.id,
                this.escaparCampo(motorista.nome),
                motorista.cpf,
                motorista.cnh,
                this.escaparCampo(empresa.razaoSocial),
                empresa.cnpj,
                String(r.sequencial),
                r.tipoEvento,
                r.timestampEvento.toISOString(),
                r.latitude?.toString() ?? '',
                r.longitude?.toString() ?? '',
                this.escaparCampo(r.observacao ?? ''),
                r.hashAnterior,
                r.hashAtual,
                r.assinaturaDigital ?? '',
                r.deviceUuidUsado,
            ].join(';'));
        }
        return '﻿' + linhas.join('\r\n') + '\r\n';
    }
    escaparCampo(valor) {
        if (valor.includes(';') || valor.includes('"') || valor.includes('\n')) {
            return `"${valor.replace(/"/g, '""')}"`;
        }
        return valor;
    }
};
exports.AejService = AejService;
exports.AejService = AejService = __decorate([
    (0, common_1.Injectable)()
], AejService);
//# sourceMappingURL=aej.service.js.map