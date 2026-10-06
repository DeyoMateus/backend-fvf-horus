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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const dashboard_service_1 = require("./dashboard.service");
const CARDS_VALIDOS = [
    'ativos',
    'em-direcao',
    'em-descanso',
    'em-espera',
    'jornada-aberta-sem-sub-evento',
    'sem-jornada-aberta',
    'sem-nenhum-registro',
    'alertas-criticos',
    'alertas-atencao',
    'alertas-24h',
    'risco-fraude-7d',
];
const INDICADORES_TENDENCIA_VALIDOS = [
    'registros',
    'alertasCritico',
    'alertasAtencao',
    'alertasInfo',
    'riscoFraude',
    'horasDirecao',
    'horasEspera',
    'horasIndefinido',
];
const REGEX_DIA = /^\d{4}-\d{2}-\d{2}$/;
let DashboardController = class DashboardController {
    dashboardService;
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
    }
    resumo(user) {
        return this.dashboardService.resumo(user.grupoId);
    }
    tendencia(user, dias, desde, ate, fusoOffsetMin) {
        return this.dashboardService.tendencia(user.grupoId, {
            dias: dias ? Number(dias) : 30,
            desde,
            ate,
            fusoOffsetMin: fusoOffsetMin !== undefined ? Number(fusoOffsetMin) : undefined,
        });
    }
    detalhe(user, card) {
        const cardValido = CARDS_VALIDOS.includes(card)
            ? card
            : '';
        return this.dashboardService.detalheCard(user.grupoId, cardValido);
    }
    tendenciaDetalhe(user, dia, indicador, fusoOffsetMin) {
        const diaValido = REGEX_DIA.test(dia ?? '') ? dia : '1970-01-01';
        const indicadorValido = INDICADORES_TENDENCIA_VALIDOS.includes(indicador)
            ? indicador
            : 'registros';
        return this.dashboardService.tendenciaDetalhe(user.grupoId, diaValido, indicadorValido, fusoOffsetMin !== undefined ? Number(fusoOffsetMin) : undefined);
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('resumo'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "resumo", null);
__decorate([
    (0, common_1.Get)('tendencia'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('dias')),
    __param(2, (0, common_1.Query)('desde')),
    __param(3, (0, common_1.Query)('ate')),
    __param(4, (0, common_1.Query)('fusoOffsetMin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "tendencia", null);
__decorate([
    (0, common_1.Get)('detalhe'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('card')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "detalhe", null);
__decorate([
    (0, common_1.Get)('tendencia-detalhe'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('dia')),
    __param(2, (0, common_1.Query)('indicador')),
    __param(3, (0, common_1.Query)('fusoOffsetMin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "tendenciaDetalhe", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('dashboard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map