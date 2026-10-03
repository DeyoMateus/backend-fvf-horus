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
exports.AjudantesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const ajudantes_service_1 = require("./ajudantes.service");
const create_ajudante_dto_1 = require("./dto/create-ajudante.dto");
const atualizar_status_ajudante_dto_1 = require("./dto/atualizar-status-ajudante.dto");
const excluir_ajudante_dto_1 = require("./dto/excluir-ajudante.dto");
const vincular_dispositivo_ajudante_dto_1 = require("./dto/vincular-dispositivo-ajudante.dto");
let AjudantesController = class AjudantesController {
    ajudantesService;
    constructor(ajudantesService) {
        this.ajudantesService = ajudantesService;
    }
    create(dto, user) {
        return this.ajudantesService.create(dto, user.grupoId, user.sub);
    }
    list(user, page, pageSize, busca, incluirExcluidos) {
        return this.ajudantesService.listByGrupo(user.grupoId, page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined, busca, incluirExcluidos === 'true');
    }
    findOne(id, user) {
        return this.ajudantesService.findById(id, user.grupoId);
    }
    atualizarStatus(id, dto, user) {
        return this.ajudantesService.atualizarStatus(id, dto, user.sub, user.grupoId);
    }
    excluir(id, dto, user) {
        return this.ajudantesService.excluir(id, dto.motivo, user.sub, user.grupoId);
    }
    vincularDispositivo(id, dto, user) {
        return this.ajudantesService.vincularDispositivo(id, dto, user.sub, user.grupoId);
    }
    statusDispositivo(id, user) {
        return this.ajudantesService.statusDispositivo(id, user.grupoId);
    }
    revogarDispositivo(id, user) {
        return this.ajudantesService.revogarDispositivo(id, user.sub, user.grupoId);
    }
};
exports.AjudantesController = AjudantesController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_ajudante_dto_1.CreateAjudanteDto, Object]),
    __metadata("design:returntype", void 0)
], AjudantesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('busca')),
    __param(4, (0, common_1.Query)('incluirExcluidos')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", void 0)
], AjudantesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AjudantesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, atualizar_status_ajudante_dto_1.AtualizarStatusAjudanteDto, Object]),
    __metadata("design:returntype", void 0)
], AjudantesController.prototype, "atualizarStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, excluir_ajudante_dto_1.ExcluirAjudanteDto, Object]),
    __metadata("design:returntype", void 0)
], AjudantesController.prototype, "excluir", null);
__decorate([
    (0, common_1.Post)(':id/dispositivo'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, vincular_dispositivo_ajudante_dto_1.VincularDispositivoAjudanteDto, Object]),
    __metadata("design:returntype", void 0)
], AjudantesController.prototype, "vincularDispositivo", null);
__decorate([
    (0, common_1.Get)(':id/dispositivo'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AjudantesController.prototype, "statusDispositivo", null);
__decorate([
    (0, common_1.Delete)(':id/dispositivo'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AjudantesController.prototype, "revogarDispositivo", null);
exports.AjudantesController = AjudantesController = __decorate([
    (0, common_1.Controller)('ajudantes'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [ajudantes_service_1.AjudantesService])
], AjudantesController);
//# sourceMappingURL=ajudantes.controller.js.map