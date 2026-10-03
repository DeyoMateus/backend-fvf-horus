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
exports.VeiculosMobileController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const motorista_device_guard_1 = require("../common/guards/motorista-device.guard");
const atualizar_veiculo_dto_1 = require("./dto/atualizar-veiculo.dto");
const veiculos_service_1 = require("./veiculos.service");
let VeiculosMobileController = class VeiculosMobileController {
    veiculosService;
    constructor(veiculosService) {
        this.veiculosService = veiculosService;
    }
    atualizar(req, dto) {
        return this.veiculosService.atualizar(req.motorista.id, dto, {
            tipo: client_1.ActorType.MOTORISTA,
            id: req.motorista.id,
        });
    }
    status(req) {
        return this.veiculosService.status(req.motorista.id);
    }
};
exports.VeiculosMobileController = VeiculosMobileController;
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, atualizar_veiculo_dto_1.AtualizarVeiculoDto]),
    __metadata("design:returntype", void 0)
], VeiculosMobileController.prototype, "atualizar", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VeiculosMobileController.prototype, "status", null);
exports.VeiculosMobileController = VeiculosMobileController = __decorate([
    (0, common_1.Controller)('dispositivo/veiculo'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __metadata("design:paramtypes", [veiculos_service_1.VeiculosService])
], VeiculosMobileController);
//# sourceMappingURL=veiculos-mobile.controller.js.map