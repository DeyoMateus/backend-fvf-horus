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
exports.MotoristasController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const create_motorista_dto_1 = require("./dto/create-motorista.dto");
const atualizar_status_motorista_dto_1 = require("./dto/atualizar-status-motorista.dto");
const atualizar_cadastro_motorista_dto_1 = require("./dto/atualizar-cadastro-motorista.dto");
const excluir_motorista_dto_1 = require("./dto/excluir-motorista.dto");
const motoristas_service_1 = require("./motoristas.service");
let MotoristasController = class MotoristasController {
    motoristasService;
    constructor(motoristasService) {
        this.motoristasService = motoristasService;
    }
    create(dto, user) {
        return this.motoristasService.create(dto, user.grupoId, user.sub);
    }
    list(user, page, pageSize, busca, incluirExcluidos) {
        return this.motoristasService.listByGrupo(user.grupoId, page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined, busca, incluirExcluidos === 'true');
    }
    findOne(id, user) {
        return this.motoristasService.findById(id, user.grupoId);
    }
    atualizarCadastro(id, dto, user) {
        return this.motoristasService.atualizarCadastro(id, dto, user.sub, user.grupoId);
    }
    atualizarStatus(id, dto, user) {
        return this.motoristasService.atualizarStatus(id, dto, user.sub, user.grupoId);
    }
    excluir(id, dto, user) {
        return this.motoristasService.excluir(id, dto.motivo, user.sub, user.grupoId);
    }
    alertasIntegridadeDispositivo(id, user) {
        return this.motoristasService.listarAlertasIntegridadeDispositivo(id, user.grupoId);
    }
};
exports.MotoristasController = MotoristasController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_motorista_dto_1.CreateMotoristaDto, Object]),
    __metadata("design:returntype", void 0)
], MotoristasController.prototype, "create", null);
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
], MotoristasController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MotoristasController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, atualizar_cadastro_motorista_dto_1.AtualizarCadastroMotoristaDto, Object]),
    __metadata("design:returntype", void 0)
], MotoristasController.prototype, "atualizarCadastro", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, atualizar_status_motorista_dto_1.AtualizarStatusMotoristaDto, Object]),
    __metadata("design:returntype", void 0)
], MotoristasController.prototype, "atualizarStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, excluir_motorista_dto_1.ExcluirMotoristaDto, Object]),
    __metadata("design:returntype", void 0)
], MotoristasController.prototype, "excluir", null);
__decorate([
    (0, common_1.Get)(':id/alertas-integridade-dispositivo'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MotoristasController.prototype, "alertasIntegridadeDispositivo", null);
exports.MotoristasController = MotoristasController = __decorate([
    (0, common_1.Controller)('motoristas'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [motoristas_service_1.MotoristasService])
], MotoristasController);
//# sourceMappingURL=motoristas.controller.js.map