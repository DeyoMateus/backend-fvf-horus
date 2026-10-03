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
exports.UsuariosEmpresaController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const atualizar_status_usuario_empresa_dto_1 = require("./dto/atualizar-status-usuario-empresa.dto");
const update_perfil_proprio_dto_1 = require("./dto/update-perfil-proprio.dto");
const usuarios_empresa_service_1 = require("./usuarios-empresa.service");
let UsuariosEmpresaController = class UsuariosEmpresaController {
    usuariosEmpresaService;
    constructor(usuariosEmpresaService) {
        this.usuariosEmpresaService = usuariosEmpresaService;
    }
    listar(user) {
        return this.usuariosEmpresaService.list(user.grupoId);
    }
    atualizarStatus(id, dto, user) {
        return this.usuariosEmpresaService.atualizarStatus(id, dto, user.grupoId, user.sub);
    }
    obterMeuPerfil(user) {
        return this.usuariosEmpresaService.obterMeuPerfil(user.sub);
    }
    atualizarMeuPerfil(dto, user) {
        return this.usuariosEmpresaService.atualizarMeuPerfil(user.sub, dto);
    }
};
exports.UsuariosEmpresaController = UsuariosEmpresaController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsuariosEmpresaController.prototype, "listar", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, atualizar_status_usuario_empresa_dto_1.AtualizarStatusUsuarioEmpresaDto, Object]),
    __metadata("design:returntype", void 0)
], UsuariosEmpresaController.prototype, "atualizarStatus", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsuariosEmpresaController.prototype, "obterMeuPerfil", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_perfil_proprio_dto_1.UpdatePerfilProprioDto, Object]),
    __metadata("design:returntype", void 0)
], UsuariosEmpresaController.prototype, "atualizarMeuPerfil", null);
exports.UsuariosEmpresaController = UsuariosEmpresaController = __decorate([
    (0, common_1.Controller)('usuarios-empresa'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [usuarios_empresa_service_1.UsuariosEmpresaService])
], UsuariosEmpresaController);
//# sourceMappingURL=usuarios-empresa.controller.js.map