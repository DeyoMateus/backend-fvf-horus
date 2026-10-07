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
exports.RegistrosJornadaController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const client_1 = require("@prisma/client");
const common_2 = require("@nestjs/common");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const aej_service_1 = require("../common/aej/aej.service");
const comprovante_service_1 = require("../common/comprovante/comprovante.service");
const rep_p_service_1 = require("../common/rep-p/rep-p.service");
const feriados_service_1 = require("../feriados/feriados.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const motorista_device_guard_1 = require("../common/guards/motorista-device.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const create_registro_jornada_dto_1 = require("./dto/create-registro-jornada.dto");
const lote_registro_jornada_dto_1 = require("./dto/lote-registro-jornada.dto");
const registros_jornada_service_1 = require("./registros-jornada.service");
const fuso_brasil_util_1 = require("../common/fuso/fuso-brasil.util");
const INCLUDE_EMPRESA_DOCUMENTO = {
    empresa: { select: { razaoSocial: true, cnpj: true, fusoHorario: true } },
};
const INCLUDE_EMPRESA_COM_REGRA_SINDICAL = {
    empresa: {
        select: {
            razaoSocial: true,
            cnpj: true,
            fusoHorario: true,
            regraSindical: true,
            grupoId: true,
        },
    },
    dispositivoVinculado: { select: { deviceUuid: true } },
};
let RegistrosJornadaController = class RegistrosJornadaController {
    registrosService;
    comprovanteService;
    aejService;
    repPService;
    feriadosService;
    prisma;
    tenant;
    constructor(registrosService, comprovanteService, aejService, repPService, feriadosService, prisma, tenant) {
        this.registrosService = registrosService;
        this.comprovanteService = comprovanteService;
        this.aejService = aejService;
        this.repPService = repPService;
        this.feriadosService = feriadosService;
        this.prisma = prisma;
        this.tenant = tenant;
    }
    create(req, dto, ip, userAgent) {
        return this.registrosService.create(req.motorista.id, req.deviceUuid, dto, ip, userAgent);
    }
    criarLote(req, dto, ip, userAgent) {
        return this.registrosService.processarLote(req.motorista.id, req.deviceUuid, dto.eventos, ip, userAgent);
    }
    async meusRegistros(req, inicio, fim) {
        const dataInicio = inicio ? new Date(inicio) : undefined;
        const dataFim = fim ? new Date(fim) : undefined;
        if ((dataInicio && Number.isNaN(dataInicio.getTime())) ||
            (dataFim && Number.isNaN(dataFim.getTime()))) {
            throw new common_2.BadRequestException('Datas inválidas (use ISO 8601)');
        }
        return this.registrosService.listarParaDispositivo(req.motorista.id, dataInicio, dataFim);
    }
    async meuComprovante(req, res, inicio, fim) {
        await this.responderComprovante(res, req.motorista.id, inicio, fim);
    }
    async meuComprovanteRegistro(req, res, idLocal) {
        const registro = await this.registrosService.buscarPorIdempotencyKey(req.motorista.id, idLocal);
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: req.motorista.id },
            include: INCLUDE_EMPRESA_DOCUMENTO,
        });
        if (!motorista)
            throw new common_2.NotFoundException('Motorista não encontrado');
        const pdf = await this.comprovanteService.gerarPdfRegistros(motorista, motorista.empresa, [registro], registro.timestampEvento, registro.timestampEvento);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="comprovante-${registro.sequencial}.pdf"`,
            'Content-Length': pdf.length,
        });
        res.send(pdf);
    }
    list(motoristaId, user) {
        return this.registrosService.listByMotorista(motoristaId, user.grupoId);
    }
    verificarIntegridade(motoristaId, user) {
        return this.registrosService.verificarIntegridade(motoristaId, user.sub, user.grupoId);
    }
    analisarEventoIntegridade(motoristaId, sequencial, user) {
        return this.registrosService.analisarEventoIntegridade(motoristaId, Number(sequencial), user.grupoId);
    }
    aceitarDivergenciaIntegridade(motoristaId, sequencial, motivo, user) {
        return this.registrosService.aceitarDivergenciaIntegridade(motoristaId, Number(sequencial), motivo, user.sub, user.grupoId);
    }
    viagens(motoristaId, user) {
        return this.registrosService.consolidarViagens(motoristaId, user.grupoId);
    }
    async aej(motoristaId, res, user, inicio, fim) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, user.grupoId);
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            include: INCLUDE_EMPRESA_DOCUMENTO,
        });
        if (!motorista)
            throw new common_2.NotFoundException('Motorista não encontrado');
        const registros = await this.registrosService.listByMotoristaNoPeriodo(motoristaId, inicio ? new Date(inicio) : undefined, fim ? new Date(fim) : undefined, (0, fuso_brasil_util_1.offsetPadraoDaEmpresa)(motorista.empresa.fusoHorario));
        const csv = this.aejService.gerarCsv(motorista, motorista.empresa, registros);
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="aej-${motoristaId}.csv"`,
        });
        res.send(csv);
    }
    async comprovante(motoristaId, res, user, inicio, fim) {
        await this.responderComprovante(res, motoristaId, inicio, fim, user.grupoId);
    }
    async espelhoRepP(motoristaId, res, user, inicio, fim) {
        await this.responderEspelhoRepP(res, motoristaId, inicio, fim, user.grupoId);
    }
    async meuEspelhoRepP(req, res, inicio, fim) {
        await this.responderEspelhoRepP(res, req.motorista.id, inicio, fim);
    }
    async responderEspelhoRepP(res, motoristaId, inicio, fim, grupoIdSolicitante) {
        if (grupoIdSolicitante) {
            await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        }
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            include: INCLUDE_EMPRESA_COM_REGRA_SINDICAL,
        });
        if (!motorista)
            throw new common_2.NotFoundException('Motorista não encontrado');
        const dataInicio = inicio ? new Date(inicio) : undefined;
        const dataFim = fim ? new Date(fim) : undefined;
        const periodoInicio = dataInicio ?? new Date(0);
        const periodoFim = dataFim ?? new Date();
        const [registros, tratamentos, feriadosRaw] = await Promise.all([
            this.registrosService.listByMotoristaNoPeriodo(motoristaId, dataInicio, dataFim, (0, fuso_brasil_util_1.offsetPadraoDaEmpresa)(motorista.empresa.fusoHorario)),
            this.prisma.tratamentoPonto.findMany({
                where: {
                    motoristaId,
                    timestampEvento: {
                        gte: (0, fuso_brasil_util_1.inicioDePeriodoBrt)(periodoInicio, (0, fuso_brasil_util_1.offsetPadraoDaEmpresa)(motorista.empresa.fusoHorario)),
                        lte: (0, fuso_brasil_util_1.fimDePeriodoBrt)(periodoFim, (0, fuso_brasil_util_1.offsetPadraoDaEmpresa)(motorista.empresa.fusoHorario)),
                    },
                },
                orderBy: { timestampEvento: 'asc' },
                include: { usuario: { select: { nome: true } } },
            }),
            this.feriadosService.listarParaRelatorio(motorista.empresa.grupoId, motorista.empresaId, periodoInicio, periodoFim),
        ]);
        const feriadosNoPeriodo = feriadosRaw.map((f) => ({
            data: f.data.toISOString().slice(0, 10),
            descricao: f.descricao,
            pagoComoDomingo: f.pagoComoDomingo,
        }));
        const pdf = await this.repPService.gerarPdf(motorista, motorista.empresa, motorista.empresa.regraSindical, registros, tratamentos, feriadosNoPeriodo, {
            periodoInicio: dataInicio ?? registros[0]?.timestampEvento ?? new Date(),
            periodoFim: dataFim ?? new Date(),
        }, motorista.dispositivoVinculado?.deviceUuid ?? null);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="espelho-rep-p-${motoristaId}.pdf"`,
            'Content-Length': pdf.length,
        });
        res.send(pdf);
    }
    async responderComprovante(res, motoristaId, inicio, fim, grupoIdSolicitante) {
        if (grupoIdSolicitante) {
            await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        }
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            include: INCLUDE_EMPRESA_DOCUMENTO,
        });
        if (!motorista)
            throw new common_2.NotFoundException('Motorista não encontrado');
        const dataInicio = inicio ? new Date(inicio) : undefined;
        const dataFim = fim ? new Date(fim) : undefined;
        const registros = await this.registrosService.listByMotoristaNoPeriodo(motoristaId, dataInicio, dataFim, (0, fuso_brasil_util_1.offsetPadraoDaEmpresa)(motorista.empresa.fusoHorario));
        const pdf = await this.comprovanteService.gerarPdfRegistros(motorista, motorista.empresa, registros, dataInicio ?? registros[0]?.timestampEvento ?? new Date(), dataFim ?? new Date());
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="comprovante-${motoristaId}.pdf"`,
            'Content-Length': pdf.length,
        });
        res.send(pdf);
    }
};
exports.RegistrosJornadaController = RegistrosJornadaController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_registro_jornada_dto_1.CreateRegistroJornadaDto, String, String]),
    __metadata("design:returntype", void 0)
], RegistrosJornadaController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('lote'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, lote_registro_jornada_dto_1.LoteRegistroJornadaDto, String, String]),
    __metadata("design:returntype", void 0)
], RegistrosJornadaController.prototype, "criarLote", null);
__decorate([
    (0, common_1.Get)('meus-registros'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('inicio')),
    __param(2, (0, common_1.Query)('fim')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], RegistrosJornadaController.prototype, "meusRegistros", null);
__decorate([
    (0, common_1.Get)('meu-comprovante'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('inicio')),
    __param(3, (0, common_1.Query)('fim')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], RegistrosJornadaController.prototype, "meuComprovante", null);
__decorate([
    (0, common_1.Get)(':idLocal/meu-comprovante'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Param)('idLocal')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], RegistrosJornadaController.prototype, "meuComprovanteRegistro", null);
__decorate([
    (0, common_1.Get)('motorista/:motoristaId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RegistrosJornadaController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('motorista/:motoristaId/verificar-integridade'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RegistrosJornadaController.prototype, "verificarIntegridade", null);
__decorate([
    (0, common_1.Get)('motorista/:motoristaId/integridade/:sequencial'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('sequencial')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], RegistrosJornadaController.prototype, "analisarEventoIntegridade", null);
__decorate([
    (0, common_1.Patch)('motorista/:motoristaId/integridade/:sequencial/aceitar'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('sequencial')),
    __param(2, (0, common_1.Body)('motivo')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], RegistrosJornadaController.prototype, "aceitarDivergenciaIntegridade", null);
__decorate([
    (0, common_1.Get)('motorista/:motoristaId/viagens'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RegistrosJornadaController.prototype, "viagens", null);
__decorate([
    (0, common_1.Get)('motorista/:motoristaId/aej'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Query)('inicio')),
    __param(4, (0, common_1.Query)('fim')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], RegistrosJornadaController.prototype, "aej", null);
__decorate([
    (0, common_1.Get)('motorista/:motoristaId/comprovante'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Query)('inicio')),
    __param(4, (0, common_1.Query)('fim')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], RegistrosJornadaController.prototype, "comprovante", null);
__decorate([
    (0, common_1.Get)('motorista/:motoristaId/espelho-rep-p'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.PapelUsuario.ADMIN, client_1.PapelUsuario.GESTOR),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, common_1.Param)('motoristaId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Query)('inicio')),
    __param(4, (0, common_1.Query)('fim')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], RegistrosJornadaController.prototype, "espelhoRepP", null);
__decorate([
    (0, common_1.Get)('meu-espelho-rep-p'),
    (0, common_1.UseGuards)(motorista_device_guard_1.MotoristaDeviceGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('inicio')),
    __param(3, (0, common_1.Query)('fim')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], RegistrosJornadaController.prototype, "meuEspelhoRepP", null);
exports.RegistrosJornadaController = RegistrosJornadaController = __decorate([
    (0, common_1.Controller)('registros-jornada'),
    __metadata("design:paramtypes", [registros_jornada_service_1.RegistrosJornadaService,
        comprovante_service_1.ComprovanteService,
        aej_service_1.AejService,
        rep_p_service_1.RepPService,
        feriados_service_1.FeriadosService,
        prisma_service_1.PrismaService,
        tenant_service_1.TenantService])
], RegistrosJornadaController);
//# sourceMappingURL=registros-jornada.controller.js.map