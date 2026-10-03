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
exports.SolicitacoesAjustePontoMobileController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const motorista_device_guard_1 = require("../common/guards/motorista-device.guard");
const create_solicitacao_ajuste_dto_1 = require("./dto/create-solicitacao-ajuste.dto");
const solicitacoes_ajuste_ponto_service_1 = require("./solicitacoes-ajuste-ponto.service");
const TAMANHO_MAXIMO_EVIDENCIA_BYTES = 25 * 1024 * 1024;
let SolicitacoesAjustePontoMobileController = class SolicitacoesAjustePontoMobileController {
    solicitacoesService;
    constructor(solicitacoesService) {
        this.solicitacoesService = solicitacoesService;
    }
    criar(req, dto) {
        return this.solicitacoesService.criar(req.motorista.id, dto);
    }
    listarMinhas(req) {
        return this.solicitacoesService.listarMinhas(req.motorista.id);
    }
    async anexarEvidencia(solicitacaoId, arquivo, req) {
        if (!arquivo)
            throw new common_1.BadRequestException('Envie o arquivo no campo "arquivo"');
        return this.solicitacoesService.anexarEvidenciaDoMotorista(solicitacaoId, req.motorista.id, arquivo);
    }
    async baixarEvidencia(evidenciaId, req, res) {
        const evidencia = await this.solicitacoesService.baixarEvidenciaDoMotorista(evidenciaId, req.motorista.id);
        res.set({
            'Content-Type': evidencia.contentType,
            'Content-Disposition': `attachment; filename="${evidencia.nomeArquivo}"`,
        });
        res.send(evidencia.conteudo);
    }
    async removerEvidencia(evidenciaId, req) {
        await this.solicitacoesService.removerEvidenciaDoMotorista(evidenciaId, req.motorista.id);
        return { ok: true };
    }
};
exports.SolicitacoesAjustePontoMobileController = SolicitacoesAjustePontoMobileController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_solicitacao_ajuste_dto_1.CreateSolicitacaoAjusteDto]),
    __metadata("design:returntype", void 0)
], SolicitacoesAjustePontoMobileController.prototype, "criar", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesAjustePontoMobileController.prototype, "listarMinhas", null);
__decorate([
    (0, common_1.Post)(':solicitacaoId/evidencias'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('arquivo', {
        limits: { fileSize: TAMANHO_MAXIMO_EVIDENCIA_BYTES },
    })),
    __param(0, (0, common_1.Param)('solicitacaoId')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SolicitacoesAjustePontoMobileController.prototype, "anexarEvidencia", null);
__decorate([
    (0, common_1.Get)('evidencias/:evidenciaId'),
    __param(0, (0, common_1.Param)('evidenciaId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SolicitacoesAjustePontoMobileController.prototype, "baixarEvidencia", null);
__decorate([
    (0, common_1.Delete)('evidencias/:evidenciaId'),
    __param(0, (0, common_1.Param)('evidenciaId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SolicitacoesAjustePontoMobileController.prototype, "removerEvidencia", null);
exports.SolicitacoesAjustePontoMobileController = SolicitacoesAjustePontoMobileController = __decorate([
    (0, common_1.Controller)('dispositivo/minhas-solicitacoes-ajuste'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __metadata("design:paramtypes", [solicitacoes_ajuste_ponto_service_1.SolicitacoesAjustePontoService])
], SolicitacoesAjustePontoMobileController);
//# sourceMappingURL=solicitacoes-ajuste-ponto-mobile.controller.js.map