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
exports.SuperAdminController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const super_admin_guard_1 = require("../common/guards/super-admin.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const create_empresa_mae_dto_1 = require("./dto/create-empresa-mae.dto");
const update_grupo_dto_1 = require("./dto/update-grupo.dto");
const update_empresa_dto_1 = require("./dto/update-empresa.dto");
const atualizar_status_empresa_dto_1 = require("./dto/atualizar-status-empresa.dto");
const destinatarios_whatsapp_usuario_dto_1 = require("./dto/destinatarios-whatsapp-usuario.dto");
const update_usuario_super_admin_dto_1 = require("./dto/update-usuario-super-admin.dto");
const create_usuario_grupo_dto_1 = require("./dto/create-usuario-grupo.dto");
const atualizar_status_usuario_empresa_dto_1 = require("../usuarios-empresa/dto/atualizar-status-usuario-empresa.dto");
const super_admin_service_1 = require("./super-admin.service");
const audit_service_1 = require("../common/audit/audit.service");
const listar_auditoria_dto_1 = require("../auditoria/dto/listar-auditoria.dto");
let SuperAdminController = class SuperAdminController {
    superAdminService;
    audit;
    constructor(superAdminService, audit) {
        this.superAdminService = superAdminService;
        this.audit = audit;
    }
    criarEmpresaMae(dto, superAdmin) {
        return this.superAdminService.criarEmpresaMae(dto, superAdmin.sub);
    }
    listarGrupos() {
        return this.superAdminService.listarGrupos();
    }
    obterGrupo(id) {
        return this.superAdminService.obterGrupo(id);
    }
    atualizarGrupo(id, dto, superAdmin) {
        return this.superAdminService.atualizarGrupo(id, dto, superAdmin.sub);
    }
    atualizarEmpresa(id, dto, superAdmin) {
        return this.superAdminService.atualizarEmpresa(id, dto, superAdmin.sub);
    }
    atualizarStatusEmpresa(id, dto, superAdmin) {
        return this.superAdminService.atualizarStatusEmpresa(id, dto.ativo, superAdmin.sub);
    }
    atualizarDestinatariosWhatsapp(id, dto, superAdmin) {
        return this.superAdminService.atualizarDestinatariosWhatsapp(id, dto, superAdmin.sub);
    }
    atualizarUsuario(id, dto, superAdmin) {
        return this.superAdminService.atualizarUsuario(id, dto, superAdmin.sub);
    }
    criarUsuarioParaGrupo(grupoId, dto, superAdmin) {
        return this.superAdminService.criarUsuarioParaGrupo(grupoId, dto, superAdmin.sub);
    }
    atualizarStatusUsuarioGrupo(grupoId, usuarioId, dto, superAdmin) {
        return this.superAdminService.atualizarStatusUsuarioGrupo(grupoId, usuarioId, dto, superAdmin.sub);
    }
    listarAuditoria(filtro) {
        return this.audit.listar({
            page: filtro.page,
            pageSize: filtro.pageSize,
            actorType: filtro.actorType,
            acoes: filtro.acoes,
            entidade: filtro.entidade,
            entidadeId: filtro.entidadeId,
            dataInicio: filtro.dataInicio ? new Date(filtro.dataInicio) : undefined,
            dataFim: filtro.dataFim ? new Date(filtro.dataFim) : undefined,
            ordem: filtro.ordem,
        }, filtro.grupoId ?? null);
    }
    listarOcorrenciasAuditoria(grupoId) {
        return this.audit.listarTiposOcorridos(grupoId ?? null);
    }
};
exports.SuperAdminController = SuperAdminController;
__decorate([
    (0, common_1.Post)('grupos'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentSuperAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_empresa_mae_dto_1.CreateEmpresaMaeDto, Object]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "criarEmpresaMae", null);
__decorate([
    (0, common_1.Get)('grupos'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "listarGrupos", null);
__decorate([
    (0, common_1.Get)('grupos/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "obterGrupo", null);
__decorate([
    (0, common_1.Patch)('grupos/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentSuperAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_grupo_dto_1.UpdateGrupoDto, Object]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "atualizarGrupo", null);
__decorate([
    (0, common_1.Patch)('empresas/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentSuperAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_empresa_dto_1.UpdateEmpresaDto, Object]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "atualizarEmpresa", null);
__decorate([
    (0, common_1.Patch)('empresas/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentSuperAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, atualizar_status_empresa_dto_1.AtualizarStatusEmpresaDto, Object]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "atualizarStatusEmpresa", null);
__decorate([
    (0, common_1.Patch)('usuarios/:id/whatsapp-alertas'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentSuperAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, destinatarios_whatsapp_usuario_dto_1.DestinatariosWhatsappUsuarioDto, Object]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "atualizarDestinatariosWhatsapp", null);
__decorate([
    (0, common_1.Patch)('usuarios/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentSuperAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_usuario_super_admin_dto_1.UpdateUsuarioSuperAdminDto, Object]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "atualizarUsuario", null);
__decorate([
    (0, common_1.Post)('grupos/:grupoId/usuarios'),
    __param(0, (0, common_1.Param)('grupoId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentSuperAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_usuario_grupo_dto_1.CreateUsuarioGrupoDto, Object]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "criarUsuarioParaGrupo", null);
__decorate([
    (0, common_1.Patch)('grupos/:grupoId/usuarios/:usuarioId/status'),
    __param(0, (0, common_1.Param)('grupoId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('usuarioId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentSuperAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, atualizar_status_usuario_empresa_dto_1.AtualizarStatusUsuarioEmpresaDto, Object]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "atualizarStatusUsuarioGrupo", null);
__decorate([
    (0, common_1.Get)('auditoria'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [listar_auditoria_dto_1.ListarAuditoriaDto]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "listarAuditoria", null);
__decorate([
    (0, common_1.Get)('auditoria/ocorrencias'),
    __param(0, (0, common_1.Query)('grupoId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "listarOcorrenciasAuditoria", null);
exports.SuperAdminController = SuperAdminController = __decorate([
    (0, common_1.Controller)('super-admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, super_admin_guard_1.SuperAdminGuard),
    __metadata("design:paramtypes", [super_admin_service_1.SuperAdminService,
        audit_service_1.AuditService])
], SuperAdminController);
//# sourceMappingURL=super-admin.controller.js.map