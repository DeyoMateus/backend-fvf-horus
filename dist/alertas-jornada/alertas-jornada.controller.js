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
exports.AlertasJornadaController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const alertas_jornada_service_1 = require("./alertas-jornada.service");
const tratar_alerta_dto_1 = require("./dto/tratar-alerta.dto");
let AlertasJornadaController = class AlertasJornadaController {
    alertasService;
    constructor(alertasService) {
        this.alertasService = alertasService;
    }
    listByMotorista(motoristaId, user, naoVisualizados) {
        return this.alertasService.listByMotorista(motoristaId, user.grupoId, naoVisualizados === 'true');
    }
    listByEmpresa(user, naoVisualizados) {
        return this.alertasService.listByGrupo(user.grupoId, naoVisualizados === 'true');
    }
    marcarVisualizado(alertaId, user) {
        return this.alertasService.marcarVisualizado(alertaId, user.sub, user.grupoId);
    }
    tratar(alertaId, dto, user) {
        return this.alertasService.tratar(alertaId, dto.observacao, user.sub, user.grupoId);
    }
};
exports.AlertasJornadaController = AlertasJornadaController;
__decorate([
    (0, common_1.Get)('motorista/:motoristaId'),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('naoVisualizados')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", void 0)
], AlertasJornadaController.prototype, "listByMotorista", null);
__decorate([
    (0, common_1.Get)('empresa/minha'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('naoVisualizados')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AlertasJornadaController.prototype, "listByEmpresa", null);
__decorate([
    (0, common_1.Patch)(':alertaId/visualizar'),
    __param(0, (0, common_1.Param)('alertaId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AlertasJornadaController.prototype, "marcarVisualizado", null);
__decorate([
    (0, common_1.Patch)(':alertaId/tratar'),
    __param(0, (0, common_1.Param)('alertaId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, tratar_alerta_dto_1.TratarAlertaDto, Object]),
    __metadata("design:returntype", void 0)
], AlertasJornadaController.prototype, "tratar", null);
exports.AlertasJornadaController = AlertasJornadaController = __decorate([
    (0, common_1.Controller)('alertas-jornada'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [alertas_jornada_service_1.AlertasJornadaService])
], AlertasJornadaController);
//# sourceMappingURL=alertas-jornada.controller.js.map