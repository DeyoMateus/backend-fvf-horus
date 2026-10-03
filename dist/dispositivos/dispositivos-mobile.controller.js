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
exports.DispositivosMobileController = void 0;
const common_1 = require("@nestjs/common");
const motorista_device_guard_1 = require("../common/guards/motorista-device.guard");
const relogio_confiavel_service_1 = require("../common/relogio-confiavel/relogio-confiavel.service");
const atualizar_push_token_dto_1 = require("./dto/atualizar-push-token.dto");
const sincronizar_relogio_dto_1 = require("./dto/sincronizar-relogio.dto");
const dispositivos_service_1 = require("./dispositivos.service");
let DispositivosMobileController = class DispositivosMobileController {
    dispositivosService;
    relogioConfiavel;
    constructor(dispositivosService, relogioConfiavel) {
        this.dispositivosService = dispositivosService;
        this.relogioConfiavel = relogioConfiavel;
    }
    async atualizarMeuPushToken(req, dto) {
        await this.dispositivosService.atualizarPushToken(req.motorista.id, dto.pushToken);
    }
    async sincronizarRelogio(req, dto) {
        const { horaServidor } = await this.relogioConfiavel.registrarAmostraEResolverPendencias(req.motorista.id, req.deviceUuid, dto.elapsedRealtimeMs);
        return { horaServidor: horaServidor.toISOString() };
    }
};
exports.DispositivosMobileController = DispositivosMobileController;
__decorate([
    (0, common_1.Patch)('meu-push-token'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, atualizar_push_token_dto_1.AtualizarPushTokenDto]),
    __metadata("design:returntype", Promise)
], DispositivosMobileController.prototype, "atualizarMeuPushToken", null);
__decorate([
    (0, common_1.Post)('relogio/sincronizar'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sincronizar_relogio_dto_1.SincronizarRelogioDto]),
    __metadata("design:returntype", Promise)
], DispositivosMobileController.prototype, "sincronizarRelogio", null);
exports.DispositivosMobileController = DispositivosMobileController = __decorate([
    (0, common_1.Controller)('dispositivo'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __metadata("design:paramtypes", [dispositivos_service_1.DispositivosService,
        relogio_confiavel_service_1.RelogioConfiavelService])
], DispositivosMobileController);
//# sourceMappingURL=dispositivos-mobile.controller.js.map