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
exports.TratamentosPontoController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const create_tratamento_ponto_dto_1 = require("./dto/create-tratamento-ponto.dto");
const tratamentos_ponto_service_1 = require("./tratamentos-ponto.service");
const TAMANHO_MAXIMO_EVIDENCIA_BYTES = 25 * 1024 * 1024;
let TratamentosPontoController = class TratamentosPontoController {
    tratamentosService;
    constructor(tratamentosService) {
        this.tratamentosService = tratamentosService;
    }
    create(motoristaId, dto, user) {
        return this.tratamentosService.create(motoristaId, dto, user.sub, user.grupoId);
    }
    contexto(motoristaId, timestamp, user) {
        const data = new Date(timestamp);
        if (!timestamp || Number.isNaN(data.getTime()))
            throw new common_1.BadRequestException('Informe "timestamp" em ISO 8601');
        return this.tratamentosService.contextoDoAjuste(motoristaId, data, user.grupoId);
    }
    list(motoristaId, user) {
        return this.tratamentosService.listByMotorista(motoristaId, user.grupoId);
    }
    async anexarEvidencia(tratamentoId, arquivo, user) {
        if (!arquivo)
            throw new common_1.BadRequestException('Envie o arquivo no campo "arquivo"');
        return this.tratamentosService.anexarEvidencia(tratamentoId, arquivo, user.sub, user.grupoId);
    }
    async baixarEvidencia(evidenciaId, res, user) {
        await this.tratamentosService.verificarEvidenciaNoGrupo(evidenciaId, user.grupoId);
        const evidencia = await this.tratamentosService.baixarEvidencia(evidenciaId);
        res.set({
            'Content-Type': evidencia.contentType,
            'Content-Disposition': `attachment; filename="${evidencia.nomeArquivo}"`,
        });
        res.send(evidencia.conteudo);
    }
    async removerEvidencia(evidenciaId, user) {
        await this.tratamentosService.removerEvidencia(evidenciaId, user.sub, user.grupoId);
        return { ok: true };
    }
};
exports.TratamentosPontoController = TratamentosPontoController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_tratamento_ponto_dto_1.CreateTratamentoPontoDto, Object]),
    __metadata("design:returntype", void 0)
], TratamentosPontoController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('contexto'),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, common_1.Query)('timestamp')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], TratamentosPontoController.prototype, "contexto", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TratamentosPontoController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':tratamentoId/evidencias'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('arquivo', {
        limits: { fileSize: TAMANHO_MAXIMO_EVIDENCIA_BYTES },
    })),
    __param(0, (0, common_1.Param)('tratamentoId')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TratamentosPontoController.prototype, "anexarEvidencia", null);
__decorate([
    (0, common_1.Get)('evidencias/:evidenciaId'),
    __param(0, (0, common_1.Param)('evidenciaId')),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TratamentosPontoController.prototype, "baixarEvidencia", null);
__decorate([
    (0, common_1.Delete)('evidencias/:evidenciaId'),
    __param(0, (0, common_1.Param)('evidenciaId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TratamentosPontoController.prototype, "removerEvidencia", null);
exports.TratamentosPontoController = TratamentosPontoController = __decorate([
    (0, common_1.Controller)('motoristas/:motoristaId/tratamentos-ponto'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [tratamentos_ponto_service_1.TratamentosPontoService])
], TratamentosPontoController);
//# sourceMappingURL=tratamentos-ponto.controller.js.map