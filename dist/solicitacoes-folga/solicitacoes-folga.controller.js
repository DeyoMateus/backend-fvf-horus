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
exports.SolicitacoesFolgaGeralController = exports.SolicitacoesFolgaPorMotoristaController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const decidir_solicitacao_folga_dto_1 = require("./dto/decidir-solicitacao-folga.dto");
const solicitacoes_folga_service_1 = require("./solicitacoes-folga.service");
let SolicitacoesFolgaPorMotoristaController = class SolicitacoesFolgaPorMotoristaController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(motoristaId, user) {
        return this.service.listarPorMotorista(motoristaId, user.grupoId);
    }
};
exports.SolicitacoesFolgaPorMotoristaController = SolicitacoesFolgaPorMotoristaController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesFolgaPorMotoristaController.prototype, "list", null);
exports.SolicitacoesFolgaPorMotoristaController = SolicitacoesFolgaPorMotoristaController = __decorate([
    (0, common_1.Controller)('motoristas/:motoristaId/solicitacoes-folga'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [solicitacoes_folga_service_1.SolicitacoesFolgaService])
], SolicitacoesFolgaPorMotoristaController);
let SolicitacoesFolgaGeralController = class SolicitacoesFolgaGeralController {
    service;
    constructor(service) {
        this.service = service;
    }
    pendentes(user) {
        return this.service.listarPendentesDoGrupo(user.grupoId);
    }
    contagem(user) {
        return this.service.contarPendentesDoGrupo(user.grupoId);
    }
    historico(user, page, pageSize, ordem) {
        return this.service.listarHistoricoDoGrupo(user.grupoId, page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined, ordem);
    }
    aprovar(id, dto, user) {
        return this.service.aprovar(id, dto.motivoDecisao, user.sub, user.grupoId);
    }
    negar(id, dto, user) {
        return this.service.negar(id, dto.motivoDecisao ?? '', user.sub, user.grupoId);
    }
};
exports.SolicitacoesFolgaGeralController = SolicitacoesFolgaGeralController;
__decorate([
    (0, common_1.Get)('pendentes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesFolgaGeralController.prototype, "pendentes", null);
__decorate([
    (0, common_1.Get)('pendentes/contagem'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesFolgaGeralController.prototype, "contagem", null);
__decorate([
    (0, common_1.Get)('historico'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('ordem')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], SolicitacoesFolgaGeralController.prototype, "historico", null);
__decorate([
    (0, common_1.Patch)(':id/aprovar'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, decidir_solicitacao_folga_dto_1.DecidirSolicitacaoFolgaDto, Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesFolgaGeralController.prototype, "aprovar", null);
__decorate([
    (0, common_1.Patch)(':id/negar'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, decidir_solicitacao_folga_dto_1.DecidirSolicitacaoFolgaDto, Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesFolgaGeralController.prototype, "negar", null);
exports.SolicitacoesFolgaGeralController = SolicitacoesFolgaGeralController = __decorate([
    (0, common_1.Controller)('solicitacoes-folga'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [solicitacoes_folga_service_1.SolicitacoesFolgaService])
], SolicitacoesFolgaGeralController);
//# sourceMappingURL=solicitacoes-folga.controller.js.map