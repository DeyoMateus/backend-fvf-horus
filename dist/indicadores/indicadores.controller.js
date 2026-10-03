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
exports.IndicadoresController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const indicadores_query_dto_1 = require("./dto/indicadores-query.dto");
const indicadores_service_1 = require("./indicadores.service");
let IndicadoresController = class IndicadoresController {
    indicadoresService;
    constructor(indicadoresService) {
        this.indicadoresService = indicadoresService;
    }
    painel(user, query) {
        return this.indicadoresService.painel(user.grupoId, new Date(query.inicio), new Date(query.fim), query.motoristaId);
    }
    async exportar(user, query, res) {
        const csv = await this.indicadoresService.exportarCsv(user.grupoId, new Date(query.inicio), new Date(query.fim), query.motoristaId);
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="indicadores-${query.inicio.slice(0, 10)}-a-${query.fim.slice(0, 10)}.csv"`,
        });
        res.send(csv);
    }
};
exports.IndicadoresController = IndicadoresController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, indicadores_query_dto_1.IndicadoresQueryDto]),
    __metadata("design:returntype", void 0)
], IndicadoresController.prototype, "painel", null);
__decorate([
    (0, common_1.Get)('exportar'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, indicadores_query_dto_1.IndicadoresQueryDto, Object]),
    __metadata("design:returntype", Promise)
], IndicadoresController.prototype, "exportar", null);
exports.IndicadoresController = IndicadoresController = __decorate([
    (0, common_1.Controller)('indicadores'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [indicadores_service_1.IndicadoresService])
], IndicadoresController);
//# sourceMappingURL=indicadores.controller.js.map