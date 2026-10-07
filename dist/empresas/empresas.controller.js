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
exports.EmpresasController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const afd_service_1 = require("../common/afd/afd.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const create_empresa_dto_1 = require("./dto/create-empresa.dto");
const empresas_service_1 = require("./empresas.service");
let EmpresasController = class EmpresasController {
    empresasService;
    afdService;
    tenant;
    constructor(empresasService, afdService, tenant) {
        this.empresasService = empresasService;
        this.afdService = afdService;
        this.tenant = tenant;
    }
    create(dto, user) {
        return this.empresasService.create(dto, user.grupoId, user.sub);
    }
    list(user) {
        return this.empresasService.list(user.grupoId);
    }
    async afd(res, user, empresaId, inicio, fim) {
        if (!empresaId || !inicio || !fim) {
            throw new common_1.BadRequestException('Informe os parâmetros de query "empresaId", "inicio" e "fim" (datas ISO).');
        }
        await this.tenant.verificarEmpresaNoGrupo(empresaId, user.grupoId);
        const { nomeArquivo, conteudo } = await this.afdService.gerarArquivo(empresaId, new Date(inicio), new Date(fim));
        res.set({
            'Content-Type': 'text/plain; charset=iso-8859-1',
            'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        });
        res.send(conteudo);
    }
    findOne(id, user) {
        return this.empresasService.findById(id, user.grupoId);
    }
    vincularRegraSindical(id, regraSindicalId, user) {
        return this.empresasService.vincularRegraSindical(id, regraSindicalId ?? null, user.grupoId, user.sub);
    }
};
exports.EmpresasController = EmpresasController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_empresa_dto_1.CreateEmpresaDto, Object]),
    __metadata("design:returntype", void 0)
], EmpresasController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmpresasController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('afd'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('empresaId')),
    __param(3, (0, common_1.Query)('inicio')),
    __param(4, (0, common_1.Query)('fim')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], EmpresasController.prototype, "afd", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EmpresasController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/regra-sindical'),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)('regraSindicalId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], EmpresasController.prototype, "vincularRegraSindical", null);
exports.EmpresasController = EmpresasController = __decorate([
    (0, common_1.Controller)('empresas'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [empresas_service_1.EmpresasService,
        afd_service_1.AfdService,
        tenant_service_1.TenantService])
], EmpresasController);
//# sourceMappingURL=empresas.controller.js.map