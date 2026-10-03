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
exports.VeiculosController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const atualizar_veiculo_dto_1 = require("./dto/atualizar-veiculo.dto");
const veiculos_service_1 = require("./veiculos.service");
let VeiculosController = class VeiculosController {
    veiculosService;
    constructor(veiculosService) {
        this.veiculosService = veiculosService;
    }
    atualizar(motoristaId, dto, user) {
        return this.veiculosService.atualizar(motoristaId, dto, { tipo: client_1.ActorType.USUARIO_EMPRESA, id: user.sub }, user.grupoId);
    }
    status(motoristaId, user) {
        return this.veiculosService.status(motoristaId, user.grupoId);
    }
    trocas(motoristaId, user) {
        return this.veiculosService.listarTrocas(motoristaId, user.grupoId);
    }
};
exports.VeiculosController = VeiculosController;
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, atualizar_veiculo_dto_1.AtualizarVeiculoDto, Object]),
    __metadata("design:returntype", void 0)
], VeiculosController.prototype, "atualizar", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VeiculosController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('trocas'),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VeiculosController.prototype, "trocas", null);
exports.VeiculosController = VeiculosController = __decorate([
    (0, common_1.Controller)('motoristas/:motoristaId/veiculo'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [veiculos_service_1.VeiculosService])
], VeiculosController);
//# sourceMappingURL=veiculos.controller.js.map