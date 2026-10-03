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
exports.AutorrelatoFolgaController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const autorrelato_folga_service_1 = require("./autorrelato-folga.service");
let AutorrelatoFolgaController = class AutorrelatoFolgaController {
    service;
    constructor(service) {
        this.service = service;
    }
    listarPorMotorista(id, user) {
        return this.service.listarPorMotorista(id, user.grupoId);
    }
    diasSemInteracao(dias, user) {
        return this.service.diasSemInteracao(user.grupoId, dias ? Number(dias) : undefined);
    }
};
exports.AutorrelatoFolgaController = AutorrelatoFolgaController;
__decorate([
    (0, common_1.Get)('motoristas/:id/autorrelatos-folga'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AutorrelatoFolgaController.prototype, "listarPorMotorista", null);
__decorate([
    (0, common_1.Get)('motoristas/relatorios/dias-sem-interacao'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Query)('dias')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AutorrelatoFolgaController.prototype, "diasSemInteracao", null);
exports.AutorrelatoFolgaController = AutorrelatoFolgaController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [autorrelato_folga_service_1.AutorrelatoFolgaService])
], AutorrelatoFolgaController);
//# sourceMappingURL=autorrelato-folga.controller.js.map