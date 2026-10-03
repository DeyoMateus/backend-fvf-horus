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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertasJornadaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../common/audit/audit.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const TIPOS_ESTOURO_JORNADA_CORRENTE = new Set([
    'DIRECAO_CONTINUA_PROXIMA_LIMITE',
    'DIRECAO_CONTINUA_EXCEDIDA',
    'JORNADA_DIRECAO_PROXIMA_LIMITE',
    'JORNADA_DIRECAO_EXCEDIDA',
    'ESPERA_PROXIMA_LIMITE',
    'ESPERA_LIMITE_LEGAL_ATINGIDO',
]);
let AlertasJornadaService = class AlertasJornadaService {
    prisma;
    audit;
    tenant;
    constructor(prisma, audit, tenant) {
        this.prisma = prisma;
        this.audit = audit;
        this.tenant = tenant;
    }
    async listByMotorista(motoristaId, grupoIdSolicitante, apenasNaoVisualizados = false) {
        if (grupoIdSolicitante) {
            await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        }
        const alertas = await this.prisma.alertaJornada.findMany({
            where: {
                motoristaId,
                ...(apenasNaoVisualizados ? { visualizadoEm: null } : {}),
            },
            orderBy: { createdAt: 'desc' },
        });
        if (grupoIdSolicitante)
            return alertas;
        const ultimoInicioJornada = await this.prisma.registroJornada.findFirst({
            where: { motoristaId, tipoEvento: 'INICIO_JORNADA' },
            orderBy: { timestampEvento: 'desc' },
            select: { timestampEvento: true },
        });
        if (!ultimoInicioJornada)
            return alertas;
        return alertas.filter((a) => !TIPOS_ESTOURO_JORNADA_CORRENTE.has(a.tipo) ||
            a.janelaFim >= ultimoInicioJornada.timestampEvento);
    }
    listByGrupo(grupoId, apenasNaoVisualizados = false) {
        return this.prisma.alertaJornada.findMany({
            where: {
                motorista: { empresa: { grupoId } },
                ...(apenasNaoVisualizados ? { visualizadoEm: null } : {}),
            },
            include: { motorista: { select: { id: true, nome: true, cpf: true } } },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
    }
    async marcarVisualizado(alertaId, usuarioId, grupoIdSolicitante) {
        const alerta = await this.prisma.alertaJornada.findUnique({
            where: { id: alertaId },
            include: {
                motorista: { select: { empresa: { select: { grupoId: true } } } },
            },
        });
        if (!alerta)
            throw new common_1.NotFoundException('Alerta não encontrado');
        if (alerta.motorista.empresa.grupoId !== grupoIdSolicitante) {
            throw new common_1.ForbiddenException('Alerta não pertence ao seu grupo');
        }
        const atualizado = await this.prisma.alertaJornada.update({
            where: { id: alertaId },
            data: { visualizadoEm: new Date(), visualizadoPorUsuarioId: usuarioId },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'ALERTA_JORNADA_VISUALIZADO',
            entidade: 'AlertaJornada',
            entidadeId: alertaId,
        });
        return atualizado;
    }
    async marcarVisualizadoPeloMotorista(alertaId, motoristaId) {
        const alerta = await this.prisma.alertaJornada.findUnique({
            where: { id: alertaId },
        });
        if (!alerta)
            throw new common_1.NotFoundException('Alerta não encontrado');
        if (alerta.motoristaId !== motoristaId) {
            throw new common_1.NotFoundException('Alerta não encontrado');
        }
        if (alerta.motoristaVisualizadoEm)
            return alerta;
        return this.prisma.alertaJornada.update({
            where: { id: alertaId },
            data: { motoristaVisualizadoEm: new Date() },
        });
    }
    async tratar(alertaId, observacao, usuarioId, grupoIdSolicitante) {
        const alerta = await this.prisma.alertaJornada.findUnique({
            where: { id: alertaId },
            include: {
                motorista: { select: { empresa: { select: { grupoId: true } } } },
            },
        });
        if (!alerta)
            throw new common_1.NotFoundException('Alerta não encontrado');
        if (alerta.motorista.empresa.grupoId !== grupoIdSolicitante) {
            throw new common_1.ForbiddenException('Alerta não pertence ao seu grupo');
        }
        const agora = new Date();
        const atualizado = await this.prisma.alertaJornada.update({
            where: { id: alertaId },
            data: {
                tratadoEm: agora,
                tratadoPorUsuarioId: usuarioId,
                tratamentoObservacao: observacao,
                visualizadoEm: alerta.visualizadoEm ?? agora,
                visualizadoPorUsuarioId: alerta.visualizadoPorUsuarioId ?? usuarioId,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'ALERTA_JORNADA_TRATADO',
            entidade: 'AlertaJornada',
            entidadeId: alertaId,
            detalhes: { observacao },
        });
        return atualizado;
    }
};
exports.AlertasJornadaService = AlertasJornadaService;
exports.AlertasJornadaService = AlertasJornadaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        tenant_service_1.TenantService])
], AlertasJornadaService);
//# sourceMappingURL=alertas-jornada.service.js.map