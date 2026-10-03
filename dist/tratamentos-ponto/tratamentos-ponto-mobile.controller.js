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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TratamentosPontoMobileController = void 0;
const common_1 = require("@nestjs/common");
const motorista_device_guard_1 = require("../common/guards/motorista-device.guard");
const tratamentos_ponto_service_1 = require("./tratamentos-ponto.service");
let TratamentosPontoMobileController = class TratamentosPontoMobileController {
    tratamentosService;
    constructor(tratamentosService) {
        this.tratamentosService = tratamentosService;
    }
    listarMeusAjustes(req) {
        return this.tratamentosService.listarMeusAjustes(req.motorista.id);
    }
    darCiencia(tratamentoId, req) {
        return this.tratamentosService.darCiencia(tratamentoId, req.motorista.id);
    }
    async baixarEvidencia(evidenciaId, req, res) {
        const evidencia = await this.tratamentosService.baixarEvidenciaDoMotorista(evidenciaId, req.motorista.id);
        res.set({
            'Content-Type': evidencia.contentType,
            'Content-Disposition': `attachment; filename="${evidencia.nomeArquivo}"`,
        });
        res.send(evidencia.conteudo);
    }
};
exports.TratamentosPontoMobileController = TratamentosPontoMobileController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TratamentosPontoMobileController.prototype, "listarMeusAjustes", null);
__decorate([
    (0, common_1.Patch)(':tratamentoId/ciencia'),
    __param(0, (0, common_1.Param)('tratamentoId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TratamentosPontoMobileController.prototype, "darCiencia", null);
__decorate([
    (0, common_1.Get)('evidencias/:evidenciaId'),
    __param(0, (0, common_1.Param)('evidenciaId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TratamentosPontoMobileController.prototype, "baixarEvidencia", null);
exports.TratamentosPontoMobileController = TratamentosPontoMobileController = __decorate([
    (0, common_1.Controller)('dispositivo/meus-ajustes'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __metadata("design:paramtypes", [tratamentos_ponto_service_1.TratamentosPontoService])
], TratamentosPontoMobileController);
//# sourceMappingURL=tratamentos-ponto-mobile.controller.js.map