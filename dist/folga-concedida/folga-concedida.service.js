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
exports.FolgaConcedidaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../common/audit/audit.service");
const whatsapp_notifications_service_1 = require("../common/notifications/whatsapp-notifications.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
function paraDiaUtc(data) {
    const d = typeof data === 'string' ? new Date(data) : data;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function proximoDiaUtc(dia) {
    const p = new Date(dia);
    p.setUTCDate(p.getUTCDate() + 1);
    return p;
}
let FolgaConcedidaService = class FolgaConcedidaService {
    prisma;
    audit;
    tenant;
    whatsapp;
    constructor(prisma, audit, tenant, whatsapp) {
        this.prisma = prisma;
        this.audit = audit;
        this.tenant = tenant;
        this.whatsapp = whatsapp;
    }
    async conceder(motoristaId, dto, usuarioId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        await this.tenant.verificarMotoristaAtivo(motoristaId);
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        const dia = paraDiaUtc(dto.data);
        const inicioProximoDia = proximoDiaUtc(dia);
        let folga;
        try {
            folga = await this.prisma.folgaConcedida.create({
                data: {
                    motoristaId,
                    data: dia,
                    motivo: dto.motivo,
                    concedidaPorUsuarioId: usuarioId,
                },
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                throw new common_1.ConflictException('Já existe uma folga concedida para este motorista nesse dia');
            }
            throw err;
        }
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'FOLGA_CONCEDIDA_CRIADA',
            entidade: 'FolgaConcedida',
            entidadeId: folga.id,
            detalhes: { motoristaId, data: dia.toISOString().slice(0, 10) },
        });
        const registrosDoDia = await this.prisma.registroJornada.findMany({
            where: {
                motoristaId,
                timestampEvento: { gte: dia, lt: inicioProximoDia },
            },
            orderBy: { sequencial: 'asc' },
        });
        if (registrosDoDia.length > 0) {
            const diaFormatado = dia.toISOString().slice(0, 10);
            const alerta = await this.prisma.alertaJornada.create({
                data: {
                    motoristaId,
                    tipo: client_1.TipoAlertaJornada.PONTO_REGISTRADO_EM_DIA_DE_FOLGA,
                    severidade: client_1.SeveridadeAlerta.ATENCAO,
                    mensagem: `Folga concedida para ${diaFormatado}, mas já existem ${registrosDoDia.length} registro(s) de ponto nesse dia , confira o conflito.`,
                    janelaInicio: dia,
                    janelaFim: inicioProximoDia,
                    minutosAcumulados: 0,
                    registroGeradorId: registrosDoDia[0].id,
                    detalhes: {
                        folgaConcedidaId: folga.id,
                        registrosConflitantesIds: registrosDoDia.map((r) => r.id),
                    },
                },
            });
            await this.audit.registrar({
                actorType: client_1.ActorType.SISTEMA,
                acao: 'ALERTA_JORNADA_PONTO_REGISTRADO_EM_DIA_DE_FOLGA',
                entidade: 'AlertaJornada',
                entidadeId: alerta.id,
                detalhes: {
                    motoristaId,
                    folgaConcedidaId: folga.id,
                    registrosConflitantes: registrosDoDia.length,
                },
            });
        }
        return folga;
    }
    async listarPorMotorista(motoristaId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        return this.prisma.folgaConcedida.findMany({
            where: { motoristaId },
            orderBy: { data: 'desc' },
            include: { concedidaPorUsuario: { select: { id: true, nome: true } } },
        });
    }
    async listarMinhas(motoristaId) {
        return this.prisma.folgaConcedida.findMany({
            where: { motoristaId },
            orderBy: { data: 'desc' },
            take: 60,
        });
    }
    async anular(motoristaId, dataStr) {
        const dia = paraDiaUtc(dataStr);
        const existente = await this.prisma.folgaConcedida.findUnique({
            where: { motoristaId_data: { motoristaId, data: dia } },
        });
        if (!existente)
            return { anulada: false };
        await this.prisma.folgaConcedida.delete({ where: { id: existente.id } });
        await this.audit.registrar({
            actorType: client_1.ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'FOLGA_CONCEDIDA_ANULADA',
            entidade: 'FolgaConcedida',
            entidadeId: existente.id,
            detalhes: {
                data: dia.toISOString().slice(0, 10),
                motivo: 'Motorista bateu ponto no dia da folga concedida',
            },
        });
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            select: { nome: true, empresaId: true },
        });
        if (motorista) {
            const diaFormatado = dia
                .toISOString()
                .slice(0, 10)
                .split('-')
                .reverse()
                .join('/');
            void this.whatsapp.notificarGestoresDaEmpresa(motorista.empresaId, `${motorista.nome} bateu ponto em ${diaFormatado}, dia em que a empresa tinha concedido folga , a folga foi anulada automaticamente.`);
        }
        return { anulada: true };
    }
};
exports.FolgaConcedidaService = FolgaConcedidaService;
exports.FolgaConcedidaService = FolgaConcedidaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        tenant_service_1.TenantService,
        whatsapp_notifications_service_1.WhatsappNotificationsService])
], FolgaConcedidaService);
//# sourceMappingURL=folga-concedida.service.js.map