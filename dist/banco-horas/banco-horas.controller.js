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
exports.BancoHorasController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const banco_horas_service_1 = require("./banco-horas.service");
const criar_ajuste_banco_horas_dto_1 = require("./dto/criar-ajuste-banco-horas.dto");
const saldo_banco_horas_query_dto_1 = require("./dto/saldo-banco-horas-query.dto");
let BancoHorasController = class BancoHorasController {
    bancoHorasService;
    constructor(bancoHorasService) {
        this.bancoHorasService = bancoHorasService;
    }
    saldo(motoristaId, query, user) {
        return this.bancoHorasService.calcularSaldo(motoristaId, new Date(query.inicio), new Date(query.fim), user.grupoId);
    }
    ajustes(motoristaId, user) {
        return this.bancoHorasService.listarAjustes(motoristaId, user.grupoId);
    }
    registrarAjuste(motoristaId, dto, user) {
        return this.bancoHorasService.registrarAjuste(motoristaId, user.grupoId, user.sub, {
            tipo: dto.tipo,
            minutos: dto.minutos,
            data: new Date(dto.data),
            observacao: dto.observacao,
        });
    }
};
exports.BancoHorasController = BancoHorasController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, saldo_banco_horas_query_dto_1.SaldoBancoHorasQueryDto, Object]),
    __metadata("design:returntype", void 0)
], BancoHorasController.prototype, "saldo", null);
__decorate([
    (0, common_1.Get)('ajustes'),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BancoHorasController.prototype, "ajustes", null);
__decorate([
    (0, common_1.Post)('ajustes'),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, criar_ajuste_banco_horas_dto_1.CriarAjusteBancoHorasDto, Object]),
    __metadata("design:returntype", void 0)
], BancoHorasController.prototype, "registrarAjuste", null);
exports.BancoHorasController = BancoHorasController = __decorate([
    (0, common_1.Controller)('motoristas/:motoristaId/banco-horas'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [banco_horas_service_1.BancoHorasService])
], BancoHorasController);
//# sourceMappingURL=banco-horas.controller.js.map