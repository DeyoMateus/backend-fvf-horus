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
exports.PrivacidadePainelController = exports.PrivacidadeMobileController = exports.PrivacidadePublicaController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const motorista_device_guard_1 = require("../common/guards/motorista-device.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const privacidade_dto_1 = require("./dto/privacidade.dto");
const privacidade_service_1 = require("./privacidade.service");
let PrivacidadePublicaController = class PrivacidadePublicaController {
    service;
    constructor(service) {
        this.service = service;
    }
    documentos() {
        return this.service.documentosPublicos();
    }
};
exports.PrivacidadePublicaController = PrivacidadePublicaController;
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60_000 } }),
    (0, common_1.Get)('documentos'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PrivacidadePublicaController.prototype, "documentos", null);
exports.PrivacidadePublicaController = PrivacidadePublicaController = __decorate([
    (0, common_1.Controller)('privacidade'),
    __metadata("design:paramtypes", [privacidade_service_1.PrivacidadeService])
], PrivacidadePublicaController);
let PrivacidadeMobileController = class PrivacidadeMobileController {
    service;
    constructor(service) {
        this.service = service;
    }
    obter(req) {
        return this.service.obterParaMotorista(req.motorista.id);
    }
    ciencia(req, dto) {
        return this.service.registrarAceite(req.motorista.id, dto.tipoDocumento, dto.versao, req.ip);
    }
    criar(req, dto) {
        return this.service.criarSolicitacao(req.motorista.id, dto.tipo, dto.descricao);
    }
    listar(req) {
        return this.service.listarDoMotorista(req.motorista.id);
    }
    meusDados(req) {
        return this.service.exportarDadosDoMotorista(req.motorista.id);
    }
};
exports.PrivacidadeMobileController = PrivacidadeMobileController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PrivacidadeMobileController.prototype, "obter", null);
__decorate([
    (0, common_1.Post)('ciencia'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, privacidade_dto_1.RegistrarAceiteDto]),
    __metadata("design:returntype", void 0)
], PrivacidadeMobileController.prototype, "ciencia", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Post)('solicitacoes'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, privacidade_dto_1.CriarSolicitacaoTitularDto]),
    __metadata("design:returntype", void 0)
], PrivacidadeMobileController.prototype, "criar", null);
__decorate([
    (0, common_1.Get)('solicitacoes'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PrivacidadeMobileController.prototype, "listar", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 60_000 } }),
    (0, common_1.Get)('meus-dados'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PrivacidadeMobileController.prototype, "meusDados", null);
exports.PrivacidadeMobileController = PrivacidadeMobileController = __decorate([
    (0, common_1.Controller)('dispositivo/privacidade'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __metadata("design:paramtypes", [privacidade_service_1.PrivacidadeService])
], PrivacidadeMobileController);
let PrivacidadePainelController = class PrivacidadePainelController {
    service;
    constructor(service) {
        this.service = service;
    }
    solicitacoes(status) {
        return this.service.listarParaPainel(status);
    }
    pendentes() {
        return this.service.listarPendentesParaSino();
    }
    responder(id, dto, user) {
        return this.service.responderSolicitacao(id, user.grupoId, user.sub, dto);
    }
    ciencias() {
        return this.service.situacaoDasCiencias();
    }
    encarregado(user) {
        return this.service.obterEncarregado(user.grupoId);
    }
    atualizarEncarregado(dto, user) {
        return this.service.atualizarEncarregado(user.grupoId, user.sub, dto);
    }
};
exports.PrivacidadePainelController = PrivacidadePainelController;
__decorate([
    (0, common_1.Get)('solicitacoes'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PrivacidadePainelController.prototype, "solicitacoes", null);
__decorate([
    (0, common_1.Get)('solicitacoes-pendentes'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PrivacidadePainelController.prototype, "pendentes", null);
__decorate([
    (0, common_1.Patch)('solicitacoes/:id'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, privacidade_dto_1.ResponderSolicitacaoTitularDto, Object]),
    __metadata("design:returntype", void 0)
], PrivacidadePainelController.prototype, "responder", null);
__decorate([
    (0, common_1.Get)('ciencias'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PrivacidadePainelController.prototype, "ciencias", null);
__decorate([
    (0, common_1.Get)('encarregado'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PrivacidadePainelController.prototype, "encarregado", null);
__decorate([
    (0, common_1.Put)('encarregado'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [privacidade_dto_1.AtualizarEncarregadoDto, Object]),
    __metadata("design:returntype", void 0)
], PrivacidadePainelController.prototype, "atualizarEncarregado", null);
exports.PrivacidadePainelController = PrivacidadePainelController = __decorate([
    (0, common_1.Controller)('privacidade/painel'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [privacidade_service_1.PrivacidadeService])
], PrivacidadePainelController);
//# sourceMappingURL=privacidade.controller.js.map