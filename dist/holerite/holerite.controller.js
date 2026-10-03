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
exports.HoleriteController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const prisma_service_1 = require("../common/prisma/prisma.service");
const gerar_holerite_dto_1 = require("./dto/gerar-holerite.dto");
const holerite_pdf_util_1 = require("./holerite-pdf.util");
const holerite_service_1 = require("./holerite.service");
const INCLUDE_EMPRESA_DOCUMENTO = {
    empresa: { select: { razaoSocial: true, cnpj: true } },
};
let HoleriteController = class HoleriteController {
    holeriteService;
    prisma;
    constructor(holeriteService, prisma) {
        this.holeriteService = holeriteService;
        this.prisma = prisma;
    }
    async calcular(motoristaId, query, user) {
        return this.holeriteService.calcular(motoristaId, new Date(query.inicio), new Date(query.fim), {
            direcaoEspera: query.direcaoEspera !== 'false',
            normalExtra: query.normalExtra !== 'false',
            adicionalNoturno: query.adicionalNoturno !== 'false',
        }, user.grupoId);
    }
    async baixarPdf(motoristaId, query, user, res) {
        const opcoes = {
            direcaoEspera: query.direcaoEspera !== 'false',
            normalExtra: query.normalExtra !== 'false',
            adicionalNoturno: query.adicionalNoturno !== 'false',
        };
        const resultado = await this.holeriteService.calcular(motoristaId, new Date(query.inicio), new Date(query.fim), opcoes, user.grupoId);
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            include: INCLUDE_EMPRESA_DOCUMENTO,
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        const pdf = await (0, holerite_pdf_util_1.gerarPdfHolerite)(motorista, motorista.empresa, resultado);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="holerite-${motorista.nome.replace(/\s+/g, '-')}-${query.inicio.slice(0, 10)}-a-${query.fim.slice(0, 10)}.pdf"`,
            'Content-Length': pdf.length,
        });
        res.send(pdf);
    }
};
exports.HoleriteController = HoleriteController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, gerar_holerite_dto_1.GerarHoleriteQueryDto, Object]),
    __metadata("design:returntype", Promise)
], HoleriteController.prototype, "calcular", null);
__decorate([
    (0, common_1.Get)('pdf'),
    __param(0, (0, common_1.Param)('motoristaId')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, gerar_holerite_dto_1.GerarHoleriteQueryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], HoleriteController.prototype, "baixarPdf", null);
exports.HoleriteController = HoleriteController = __decorate([
    (0, common_1.Controller)('motoristas/:motoristaId/holerite'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [holerite_service_1.HoleriteService,
        prisma_service_1.PrismaService])
], HoleriteController);
//# sourceMappingURL=holerite.controller.js.map