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
exports.FechamentoHoleriteController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const fechamento_holerite_dto_1 = require("./dto/fechamento-holerite.dto");
const holerite_pdf_util_1 = require("./holerite-pdf.util");
const holerite_service_1 = require("./holerite.service");
const zip_util_1 = require("../common/zip/zip.util");
let FechamentoHoleriteController = class FechamentoHoleriteController {
    holeriteService;
    constructor(holeriteService) {
        this.holeriteService = holeriteService;
    }
    async pdf(user, query, res) {
        const motoristaIds = query.motoristaIds
            ? query.motoristaIds
                .split(',')
                .map((id) => id.trim())
                .filter((id) => id.length > 0)
            : null;
        const opcoes = {
            direcaoEspera: query.direcaoEspera !== 'false',
            normalExtra: query.normalExtra !== 'false',
            adicionalNoturno: query.adicionalNoturno !== 'false',
        };
        const dataInicio = new Date(query.inicio);
        const dataFim = new Date(query.fim);
        const itens = await this.holeriteService.calcularEmLote(motoristaIds, dataInicio, dataFim, opcoes, user.grupoId);
        const sufixoPeriodo = `${query.inicio.slice(0, 10)}-a-${query.fim.slice(0, 10)}`;
        if (itens.length === 1) {
            const pdf = await (0, holerite_pdf_util_1.gerarPdfHolerite)(itens[0].motorista, itens[0].empresa, itens[0].resultado);
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="holerite-${itens[0].motorista.nome.replace(/\s+/g, '-')}-${sufixoPeriodo}.pdf"`,
                'Content-Length': pdf.length,
            });
            res.send(pdf);
            return;
        }
        const nomesUsados = new Set();
        const arquivos = await Promise.all(itens.map(async (item) => {
            const pdf = await (0, holerite_pdf_util_1.gerarPdfHolerite)(item.motorista, item.empresa, item.resultado);
            const base = item.motorista.nome.replace(/\s+/g, '-');
            let nome = `holerite-${base}-${sufixoPeriodo}.pdf`;
            let sufixo = 2;
            while (nomesUsados.has(nome)) {
                nome = `holerite-${base}-${sufixoPeriodo}-${sufixo}.pdf`;
                sufixo++;
            }
            nomesUsados.add(nome);
            return { nome, conteudo: pdf };
        }));
        const zip = (0, zip_util_1.criarZip)(arquivos);
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="fechamento-frota-${sufixoPeriodo}.zip"`,
            'Content-Length': zip.length,
        });
        res.send(zip);
    }
};
exports.FechamentoHoleriteController = FechamentoHoleriteController;
__decorate([
    (0, common_1.Get)('pdf'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, fechamento_holerite_dto_1.FechamentoHoleriteQueryDto, Object]),
    __metadata("design:returntype", Promise)
], FechamentoHoleriteController.prototype, "pdf", null);
exports.FechamentoHoleriteController = FechamentoHoleriteController = __decorate([
    (0, common_1.Controller)('holerite-fechamento'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __metadata("design:paramtypes", [holerite_service_1.HoleriteService])
], FechamentoHoleriteController);
//# sourceMappingURL=fechamento-holerite.controller.js.map