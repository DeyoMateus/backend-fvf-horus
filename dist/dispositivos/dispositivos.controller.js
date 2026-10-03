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
exports.DispositivosController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const dispositivos_service_1 = require("./dispositivos.service");
const vincular_dispositivo_dto_1 = require("./dto/vincular-dispositivo.dto");
let DispositivosController = class DispositivosController {
    dispositivosService;
    constructor(dispositivosService) {
        this.dispositivosService = dispositivosService;
    }
    vincular(motoristaId, dto, user) {
        return this.dispositivosService.vincular(motoristaId, dto, user.sub, user.grupoId);
    }
    status(motoristaId, user) {
        return this.dispositivosService.status(motoristaId, user.grupoId);
    }
    revogar(motoristaId, user) {
        return this.dispositivosService.revogar(motoristaId, user.sub, user.grupoId);
    }
};
exports.DispositivosController = DispositivosController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, vincular_dispositivo_dto_1.VincularDispositivoDto, Object]),
    __metadata("design:returntype", void 0)
], DispositivosController.prototype, "vincular", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DispositivosController.prototype, "status", null);
__decorate([
    (0, common_1.Delete)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DispositivosController.prototype, "revogar", null);
exports.DispositivosController = DispositivosController = __decorate([
    (0, common_1.Controller)('motoristas/:motoristaId/dispositivo'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [dispositivos_service_1.DispositivosService])
], DispositivosController);
//# sourceMappingURL=dispositivos.controller.js.map