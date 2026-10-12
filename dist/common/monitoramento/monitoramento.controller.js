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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoramentoController = void 0;
const common_1 = require("@nestjs/common");
const monitoramento_operacional_service_1 = require("./monitoramento-operacional.service");
let MonitoramentoController = class MonitoramentoController {
    monitoramento;
    constructor(monitoramento) {
        this.monitoramento = monitoramento;
    }
    async completo() {
        const estado = await this.monitoramento.verificar();
        const corpo = {
            status: estado.saudavel ? 'ok' : 'erro',
            verificadoEm: estado.verificadoEm,
            verificacoes: Object.fromEntries(estado.verificacoes.map((v) => [v.chave, v.ok ? 'ok' : 'erro'])),
        };
        if (!estado.saudavel)
            throw new common_1.ServiceUnavailableException(corpo);
        return corpo;
    }
};
exports.MonitoramentoController = MonitoramentoController;
__decorate([
    (0, common_1.Get)('completo'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MonitoramentoController.prototype, "completo", null);
exports.MonitoramentoController = MonitoramentoController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [monitoramento_operacional_service_1.MonitoramentoOperacionalService])
], MonitoramentoController);
//# sourceMappingURL=monitoramento.controller.js.map