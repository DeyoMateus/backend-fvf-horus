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
exports.RegistrosJornadaAjudanteController = void 0;
const common_1 = require("@nestjs/common");
const ajudante_device_guard_1 = require("../common/guards/ajudante-device.guard");
const create_registro_jornada_ajudante_dto_1 = require("./dto/create-registro-jornada-ajudante.dto");
const registros_jornada_ajudante_service_1 = require("./registros-jornada-ajudante.service");
let RegistrosJornadaAjudanteController = class RegistrosJornadaAjudanteController {
    registrosService;
    constructor(registrosService) {
        this.registrosService = registrosService;
    }
    create(req, dto, ip, userAgent) {
        return this.registrosService.create(req.ajudante.id, req.deviceUuid, dto, ip, userAgent);
    }
    meuHistorico(req) {
        return this.registrosService.listarPorAjudante(req.ajudante.id);
    }
};
exports.RegistrosJornadaAjudanteController = RegistrosJornadaAjudanteController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_registro_jornada_ajudante_dto_1.CreateRegistroJornadaAjudanteDto, String, String]),
    __metadata("design:returntype", void 0)
], RegistrosJornadaAjudanteController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('meu-historico'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RegistrosJornadaAjudanteController.prototype, "meuHistorico", null);
exports.RegistrosJornadaAjudanteController = RegistrosJornadaAjudanteController = __decorate([
    (0, common_1.Controller)('registros-jornada-ajudante'),
    (0, common_1.UseGuards)(ajudante_device_guard_1.AjudanteDeviceGuard),
    __metadata("design:paramtypes", [registros_jornada_ajudante_service_1.RegistrosJornadaAjudanteService])
], RegistrosJornadaAjudanteController);
//# sourceMappingURL=registros-jornada-ajudante.controller.js.map