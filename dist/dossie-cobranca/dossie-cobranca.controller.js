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
exports.DossieCobrancaController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const prisma_service_1 = require("../common/prisma/prisma.service");
const listar_dossie_cobranca_dto_1 = require("./dto/listar-dossie-cobranca.dto");
const dossie_cobranca_service_1 = require("./dossie-cobranca.service");
const dossie_cobranca_pdf_util_1 = require("./dossie-cobranca-pdf.util");
let DossieCobrancaController = class DossieCobrancaController {
    dossieService;
    prisma;
    constructor(dossieService, prisma) {
        this.dossieService = dossieService;
        this.prisma = prisma;
    }
    listar(user, query) {
        return this.dossieService.listar(user.grupoId, new Date(query.inicio), new Date(query.fim), query.motoristaId);
    }
    async pdf(user, query, res) {
        const dataInicio = new Date(query.inicio);
        const dataFim = new Date(query.fim);
        const itens = await this.dossieService.listar(user.grupoId, dataInicio, dataFim, query.motoristaId);
        const empresa = await this.prisma.empresa.findFirst({
            where: { grupoId: user.grupoId },
            select: { razaoSocial: true },
        });
        const pdf = await (0, dossie_cobranca_pdf_util_1.gerarPdfDossieCobranca)(itens, empresa?.razaoSocial ?? 'Empresa', dataInicio, dataFim);
        const sufixoPeriodo = `${query.inicio.slice(0, 10)}-a-${query.fim.slice(0, 10)}`;
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="dossie-cobranca-${sufixoPeriodo}.pdf"`,
            'Content-Length': pdf.length,
        });
        res.send(pdf);
    }
};
exports.DossieCobrancaController = DossieCobrancaController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, listar_dossie_cobranca_dto_1.ListarDossieCobrancaDto]),
    __metadata("design:returntype", void 0)
], DossieCobrancaController.prototype, "listar", null);
__decorate([
    (0, common_1.Get)('pdf'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, listar_dossie_cobranca_dto_1.ListarDossieCobrancaDto, Object]),
    __metadata("design:returntype", Promise)
], DossieCobrancaController.prototype, "pdf", null);
exports.DossieCobrancaController = DossieCobrancaController = __decorate([
    (0, common_1.Controller)('dossie-cobranca'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [dossie_cobranca_service_1.DossieCobrancaService,
        prisma_service_1.PrismaService])
], DossieCobrancaController);
//# sourceMappingURL=dossie-cobranca.controller.js.map