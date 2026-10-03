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
exports.AuditoriaController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const audit_service_1 = require("../common/audit/audit.service");
const listar_auditoria_dto_1 = require("./dto/listar-auditoria.dto");
let AuditoriaController = class AuditoriaController {
    audit;
    constructor(audit) {
        this.audit = audit;
    }
    listar(user, filtro) {
        return this.audit.listar({
            page: filtro.page,
            pageSize: filtro.pageSize,
            actorType: filtro.actorType,
            excluirActorTypes: [client_1.ActorType.SUPER_ADMIN],
            acoes: filtro.acoes,
            entidade: filtro.entidade,
            entidadeId: filtro.entidadeId,
            dataInicio: filtro.dataInicio ? new Date(filtro.dataInicio) : undefined,
            dataFim: filtro.dataFim ? new Date(filtro.dataFim) : undefined,
            ordem: filtro.ordem,
        }, user.grupoId);
    }
    listarOcorrencias(user) {
        return this.audit.listarTiposOcorridos(user.grupoId);
    }
};
exports.AuditoriaController = AuditoriaController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, listar_auditoria_dto_1.ListarAuditoriaDto]),
    __metadata("design:returntype", void 0)
], AuditoriaController.prototype, "listar", null);
__decorate([
    (0, common_1.Get)('ocorrencias'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuditoriaController.prototype, "listarOcorrencias", null);
exports.AuditoriaController = AuditoriaController = __decorate([
    (0, common_1.Controller)('auditoria'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [audit_service_1.AuditService])
], AuditoriaController);
//# sourceMappingURL=auditoria.controller.js.map