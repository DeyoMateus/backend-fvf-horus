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
exports.AlertasJornadaMobileController = void 0;
const common_1 = require("@nestjs/common");
const motorista_device_guard_1 = require("../common/guards/motorista-device.guard");
const alertas_jornada_service_1 = require("./alertas-jornada.service");
let AlertasJornadaMobileController = class AlertasJornadaMobileController {
    alertasService;
    constructor(alertasService) {
        this.alertasService = alertasService;
    }
    listarMeusAlertas(req, naoVisualizados) {
        return this.alertasService.listByMotorista(req.motorista.id, undefined, naoVisualizados === 'true');
    }
    marcarVisualizado(alertaId, req) {
        return this.alertasService.marcarVisualizadoPeloMotorista(alertaId, req.motorista.id);
    }
};
exports.AlertasJornadaMobileController = AlertasJornadaMobileController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('naoVisualizados')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AlertasJornadaMobileController.prototype, "listarMeusAlertas", null);
__decorate([
    (0, common_1.Patch)(':alertaId/visualizar'),
    __param(0, (0, common_1.Param)('alertaId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AlertasJornadaMobileController.prototype, "marcarVisualizado", null);
exports.AlertasJornadaMobileController = AlertasJornadaMobileController = __decorate([
    (0, common_1.Controller)('dispositivo/meus-alertas'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __metadata("design:paramtypes", [alertas_jornada_service_1.AlertasJornadaService])
], AlertasJornadaMobileController);
//# sourceMappingURL=alertas-jornada-mobile.controller.js.map