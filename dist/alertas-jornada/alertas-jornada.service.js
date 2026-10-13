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
    'DIRECAO_RETOMADA_SEM_PAUSA',
    'JORNADA_ABERTA_PROLONGADA',
    'JORNADA_DIRECAO_PROXIMA_LIMITE',
    'JORNADA_DIRECAO_EXCEDIDA',
    'JORNADA_ATUAL_DIRECAO_PROXIMA_LIMITE',
    'JORNADA_ATUAL_DIRECAO_EXCEDIDA',
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
                ...(grupoIdSolicitante
                    ? {}
                    : { tipo: { not: 'INTEGRIDADE_CADEIA_VIOLADA' } }),
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
    async exigirJornadaEncerradaParaDispensar(alerta) {
        if (alerta.tipo !== 'JORNADA_ABERTA_PROLONGADA')
            return;
        const ultimo = await this.prisma.registroJornada.findFirst({
            where: { motoristaId: alerta.motoristaId, tipoEvento: { not: 'OUTRO' } },
            orderBy: [{ timestampEvento: 'desc' }, { sequencial: 'desc' }],
        });
        if (!ultimo || ultimo.tipoEvento === 'FIM_JORNADA')
            return;
        const inicioAtual = await this.prisma.registroJornada.findFirst({
            where: { motoristaId: alerta.motoristaId, tipoEvento: 'INICIO_JORNADA' },
            orderBy: [{ timestampEvento: 'desc' }, { sequencial: 'desc' }],
        });
        if (inicioAtual &&
            alerta.janelaInicio.getTime() < inicioAtual.timestampEvento.getTime()) {
            return;
        }
        const ajuste = await this.prisma.tratamentoPonto.findFirst({
            where: {
                motoristaId: alerta.motoristaId,
                tipoEvento: 'FIM_JORNADA',
                timestampEvento: { gte: alerta.janelaInicio },
            },
        });
        if (ajuste)
            return;
        throw new common_1.BadRequestException('Esta jornada continua aberta há mais de 14h. Encerre a jornada (Tratamento de ponto, evento "FIM_JORNADA", com justificativa) antes de dispensar este alerta.');
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
        await this.exigirJornadaEncerradaParaDispensar(alerta);
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
        await this.exigirJornadaEncerradaParaDispensar(alerta);
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