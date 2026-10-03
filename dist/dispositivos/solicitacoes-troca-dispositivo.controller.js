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
exports.SolicitacoesTrocaDispositivoController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const dispositivos_service_1 = require("./dispositivos.service");
const rejeitar_solicitacao_troca_dto_1 = require("./dto/rejeitar-solicitacao-troca.dto");
const solicitar_troca_dispositivo_dto_1 = require("./dto/solicitar-troca-dispositivo.dto");
let SolicitacoesTrocaDispositivoController = class SolicitacoesTrocaDispositivoController {
    dispositivosService;
    constructor(dispositivosService) {
        this.dispositivosService = dispositivosService;
    }
    solicitar(dto) {
        return this.dispositivosService.solicitarTroca(dto);
    }
    listarPendentes(user) {
        return this.dispositivosService.listarSolicitacoesPendentes(user.grupoId);
    }
    aprovar(id, user) {
        return this.dispositivosService.aprovarTroca(id, user.sub, user.grupoId);
    }
    rejeitar(id, dto, user) {
        return this.dispositivosService.rejeitarTroca(id, user.sub, dto.motivo, user.grupoId);
    }
};
exports.SolicitacoesTrocaDispositivoController = SolicitacoesTrocaDispositivoController;
__decorate([
    (0, common_1.Post)(),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [solicitar_troca_dispositivo_dto_1.SolicitarTrocaDispositivoDto]),
    __metadata("design:returntype", void 0)
], SolicitacoesTrocaDispositivoController.prototype, "solicitar", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesTrocaDispositivoController.prototype, "listarPendentes", null);
__decorate([
    (0, common_1.Patch)(':id/aprovar'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesTrocaDispositivoController.prototype, "aprovar", null);
__decorate([
    (0, common_1.Patch)(':id/rejeitar'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, rejeitar_solicitacao_troca_dto_1.RejeitarSolicitacaoTrocaDto, Object]),
    __metadata("design:returntype", void 0)
], SolicitacoesTrocaDispositivoController.prototype, "rejeitar", null);
exports.SolicitacoesTrocaDispositivoController = SolicitacoesTrocaDispositivoController = __decorate([
    (0, common_1.Controller)('solicitacoes-troca-dispositivo'),
    __metadata("design:paramtypes", [dispositivos_service_1.DispositivosService])
], SolicitacoesTrocaDispositivoController);
//# sourceMappingURL=solicitacoes-troca-dispositivo.controller.js.map