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
exports.SolicitacoesAjustePontoGeralController = exports.SolicitacoesAjustePontoPorMotoristaController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const decidir_solicitacao_dto_1 = require("./dto/decidir-solicitacao.dto");
const solicitacoes_ajuste_ponto_service_1 = require("./solicitacoes-ajuste-ponto.service");
let SolicitacoesAjustePontoPorMotoristaController = class SolicitacoesAjustePontoPorMotoristaController {
    solicitacoesService;
    constructor(solicitacoesService) {
        this.solicitacoesService = solicitacoesService;
    }
    list(motoristaId, user) {
        return this.solicitacoesService.listarPorMotorista(motoristaId, user.grupoId);
    }
};
exports.SolicitacoesAjustePontoPorMotoristaController = SolicitacoesAjustePontoPorMotoristaController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesAjustePontoPorMotoristaController.prototype, "list", null);
exports.SolicitacoesAjustePontoPorMotoristaController = SolicitacoesAjustePontoPorMotoristaController = __decorate([
    (0, common_1.Controller)('motoristas/:motoristaId/solicitacoes-ajuste-ponto'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [solicitacoes_ajuste_ponto_service_1.SolicitacoesAjustePontoService])
], SolicitacoesAjustePontoPorMotoristaController);
let SolicitacoesAjustePontoGeralController = class SolicitacoesAjustePontoGeralController {
    solicitacoesService;
    constructor(solicitacoesService) {
        this.solicitacoesService = solicitacoesService;
    }
    pendentes(user) {
        return this.solicitacoesService.listarPendentesDoGrupo(user.grupoId);
    }
    historico(user, page, pageSize, ordem) {
        return this.solicitacoesService.listarHistoricoDoGrupo(user.grupoId, page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined, ordem);
    }
    aprovar(id, dto, user) {
        return this.solicitacoesService.aprovar(id, dto.motivoDecisao, user.sub, user.grupoId);
    }
    rejeitar(id, dto, user) {
        return this.solicitacoesService.rejeitar(id, dto.motivoDecisao ?? '', user.sub, user.grupoId);
    }
    async baixarEvidencia(evidenciaId, user, res) {
        const evidencia = await this.solicitacoesService.baixarEvidenciaDoPainel(evidenciaId, user.grupoId);
        res.set({
            'Content-Type': evidencia.contentType,
            'Content-Disposition': `attachment; filename="${evidencia.nomeArquivo}"`,
        });
        res.send(evidencia.conteudo);
    }
    async removerEvidencia(evidenciaId, user) {
        await this.solicitacoesService.removerEvidenciaDoPainel(evidenciaId, user.grupoId);
        return { ok: true };
    }
};
exports.SolicitacoesAjustePontoGeralController = SolicitacoesAjustePontoGeralController;
__decorate([
    (0, common_1.Get)('pendentes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesAjustePontoGeralController.prototype, "pendentes", null);
__decorate([
    (0, common_1.Get)('historico'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('ordem')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], SolicitacoesAjustePontoGeralController.prototype, "historico", null);
__decorate([
    (0, common_1.Patch)(':id/aprovar'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, decidir_solicitacao_dto_1.DecidirSolicitacaoDto, Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesAjustePontoGeralController.prototype, "aprovar", null);
__decorate([
    (0, common_1.Patch)(':id/rejeitar'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, decidir_solicitacao_dto_1.DecidirSolicitacaoDto, Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesAjustePontoGeralController.prototype, "rejeitar", null);
__decorate([
    (0, common_1.Get)('evidencias/:evidenciaId'),
    __param(0, (0, common_1.Param)('evidenciaId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SolicitacoesAjustePontoGeralController.prototype, "baixarEvidencia", null);
__decorate([
    (0, common_1.Delete)('evidencias/:evidenciaId'),
    __param(0, (0, common_1.Param)('evidenciaId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SolicitacoesAjustePontoGeralController.prototype, "removerEvidencia", null);
exports.SolicitacoesAjustePontoGeralController = SolicitacoesAjustePontoGeralController = __decorate([
    (0, common_1.Controller)('solicitacoes-ajuste-ponto'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [solicitacoes_ajuste_ponto_service_1.SolicitacoesAjustePontoService])
], SolicitacoesAjustePontoGeralController);
//# sourceMappingURL=solicitacoes-ajuste-ponto.controller.js.map