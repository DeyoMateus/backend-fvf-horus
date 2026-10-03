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
exports.DocumentosCargaController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const create_documento_carga_dto_1 = require("./dto/create-documento-carga.dto");
const documentos_carga_service_1 = require("./documentos-carga.service");
const TAMANHO_MAXIMO_XML_BYTES = 5 * 1024 * 1024;
let DocumentosCargaController = class DocumentosCargaController {
    service;
    constructor(service) {
        this.service = service;
    }
    upload(arquivo, dto, user) {
        if (!arquivo)
            throw new common_1.BadRequestException('Envie o arquivo XML no campo "arquivo"');
        if (!arquivo.originalname.toLowerCase().endsWith('.xml')) {
            throw new common_1.BadRequestException('Só arquivos .xml são aceitos');
        }
        const inicioArquivo = arquivo.buffer
            .subarray(0, 512)
            .toString('utf-8')
            .trimStart();
        if (!inicioArquivo.startsWith('<?xml') && !inicioArquivo.startsWith('<')) {
            throw new common_1.BadRequestException('O conteúdo do arquivo não parece ser um XML válido');
        }
        return this.service.upload(user.grupoId, user.sub, dto, arquivo);
    }
    list(user, page, pageSize, ordem, tipo, statusCarga, motoristaId, numero, chaveAcesso) {
        return this.service.listByGrupo(user.grupoId, page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined, ordem, { tipo, statusCarga, motoristaId, numero, chaveAcesso });
    }
    listByMotorista(motoristaId, user) {
        return this.service.listByMotorista(motoristaId, user.grupoId);
    }
    statusAtual(motoristaId, user) {
        return this.service.statusAtualPorMotorista(motoristaId, user.grupoId);
    }
    remover(id, user) {
        return this.service.remover(id, user.sub, user.grupoId);
    }
    async baixarXml(id, res, user, inline) {
        const documento = await this.service.baixarXml(id, user.grupoId);
        res.set({
            'Content-Type': 'application/xml',
            'Content-Disposition': `${inline === 'true' ? 'inline' : 'attachment'}; filename="${documento.tipo.toLowerCase()}-${documento.numero ?? documento.id}.xml"`,
        });
        res.send(documento.xmlOriginal);
    }
};
exports.DocumentosCargaController = DocumentosCargaController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('arquivo', {
        limits: { fileSize: TAMANHO_MAXIMO_XML_BYTES },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_documento_carga_dto_1.CreateDocumentoCargaDto, Object]),
    __metadata("design:returntype", void 0)
], DocumentosCargaController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('ordem')),
    __param(4, (0, common_1.Query)('tipo')),
    __param(5, (0, common_1.Query)('statusCarga')),
    __param(6, (0, common_1.Query)('motoristaId')),
    __param(7, (0, common_1.Query)('numero')),
    __param(8, (0, common_1.Query)('chaveAcesso')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], DocumentosCargaController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('motorista/:motoristaId'),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DocumentosCargaController.prototype, "listByMotorista", null);
__decorate([
    (0, common_1.Get)('motorista/:motoristaId/status-atual'),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DocumentosCargaController.prototype, "statusAtual", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DocumentosCargaController.prototype, "remover", null);
__decorate([
    (0, common_1.Get)(':id/xml'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Query)('inline')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, String]),
    __metadata("design:returntype", Promise)
], DocumentosCargaController.prototype, "baixarXml", null);
exports.DocumentosCargaController = DocumentosCargaController = __decorate([
    (0, common_1.Controller)('documentos-carga'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [documentos_carga_service_1.DocumentosCargaService])
], DocumentosCargaController);
//# sourceMappingURL=documentos-carga.controller.js.map