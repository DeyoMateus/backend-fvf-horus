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
exports.AutorrelatoFolgaService = void 0;
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
function chaveDia(d) {
    return d.toISOString().slice(0, 10);
}
let AutorrelatoFolgaService = class AutorrelatoFolgaService {
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
    async autorrelatar(motoristaId, dto) {
        const dia = paraDiaUtc(dto.data);
        const registro = await this.prisma.autorrelatoFolga.upsert({
            where: { motoristaId_data: { motoristaId, data: dia } },
            create: { motoristaId, data: dia, observacao: dto.observacao },
            update: { observacao: dto.observacao },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'AUTORRELATO_FOLGA',
            entidade: 'AutorrelatoFolga',
            entidadeId: registro.id,
            detalhes: { data: chaveDia(dia) },
        });
        return registro;
    }
    async listarPorMotorista(motoristaId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        return this.prisma.autorrelatoFolga.findMany({
            where: { motoristaId },
            orderBy: { data: 'desc' },
            take: 60,
        });
    }
    async listarMinhas(motoristaId) {
        return this.prisma.autorrelatoFolga.findMany({
            where: { motoristaId },
            orderBy: { data: 'desc' },
            take: 60,
        });
    }
    async anular(motoristaId, dataStr) {
        const dia = paraDiaUtc(dataStr);
        const existente = await this.prisma.autorrelatoFolga.findUnique({
            where: { motoristaId_data: { motoristaId, data: dia } },
        });
        if (!existente)
            return { anulada: false };
        await this.prisma.autorrelatoFolga.delete({ where: { id: existente.id } });
        await this.audit.registrar({
            actorType: client_1.ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'AUTORRELATO_FOLGA_ANULADA',
            entidade: 'AutorrelatoFolga',
            entidadeId: existente.id,
            detalhes: {
                data: chaveDia(dia),
                motivo: 'Motorista bateu ponto no dia avisado como folga',
            },
        });
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            select: { nome: true, empresaId: true },
        });
        if (motorista) {
            const diaFormatado = chaveDia(dia);
            void this.whatsapp.notificarGestoresDaEmpresa(motorista.empresaId, `${motorista.nome} bateu ponto em ${diaFormatado.split('-').reverse().join('/')}, dia que tinha avisado como folga , a folga foi anulada automaticamente.`);
        }
        return { anulada: true };
    }
    async diasSemInteracao(grupoId, dias = 7) {
        const hojeUtc = paraDiaUtc(new Date());
        const inicioUtc = new Date(hojeUtc);
        inicioUtc.setUTCDate(inicioUtc.getUTCDate() - Math.min(Math.max(dias, 1), 90));
        const motoristas = await this.prisma.motorista.findMany({
            where: { empresa: { grupoId }, status: 'ATIVO' },
            select: { id: true, nome: true, createdAt: true },
        });
        if (motoristas.length === 0)
            return [];
        const [registros, autorrelatos, folgasConcedidas] = await Promise.all([
            this.prisma.registroJornada.findMany({
                where: {
                    motorista: { empresa: { grupoId } },
                    timestampEvento: { gte: inicioUtc, lt: hojeUtc },
                },
                select: { motoristaId: true, timestampEvento: true },
            }),
            this.prisma.autorrelatoFolga.findMany({
                where: {
                    motoristaId: { in: motoristas.map((m) => m.id) },
                    data: { gte: inicioUtc, lt: hojeUtc },
                },
                select: { motoristaId: true, data: true },
            }),
            this.prisma.folgaConcedida.findMany({
                where: {
                    motoristaId: { in: motoristas.map((m) => m.id) },
                    data: { gte: inicioUtc, lt: hojeUtc },
                },
                select: { motoristaId: true, data: true },
            }),
        ]);
        const diasComRegistro = new Map();
        for (const r of registros) {
            const set = diasComRegistro.get(r.motoristaId) ?? new Set();
            set.add(chaveDia(r.timestampEvento));
            diasComRegistro.set(r.motoristaId, set);
        }
        const diasComFolga = new Map();
        for (const a of autorrelatos) {
            const set = diasComFolga.get(a.motoristaId) ?? new Set();
            set.add(chaveDia(a.data));
            diasComFolga.set(a.motoristaId, set);
        }
        for (const f of folgasConcedidas) {
            const set = diasComFolga.get(f.motoristaId) ?? new Set();
            set.add(chaveDia(f.data));
            diasComFolga.set(f.motoristaId, set);
        }
        const resultado = [];
        for (const motorista of motoristas) {
            const inicioMotorista = new Date(Math.max(inicioUtc.getTime(), paraDiaUtc(motorista.createdAt).getTime()));
            const diasFaltando = [];
            for (const cursor = new Date(inicioMotorista); cursor.getTime() < hojeUtc.getTime(); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
                const chave = chaveDia(cursor);
                const temRegistro = diasComRegistro.get(motorista.id)?.has(chave) ?? false;
                const temFolga = diasComFolga.get(motorista.id)?.has(chave) ?? false;
                if (!temRegistro && !temFolga)
                    diasFaltando.push(chave);
            }
            if (diasFaltando.length > 0) {
                resultado.push({
                    motoristaId: motorista.id,
                    nome: motorista.nome,
                    diasSemInteracao: diasFaltando,
                });
            }
        }
        return resultado;
    }
};
exports.AutorrelatoFolgaService = AutorrelatoFolgaService;
exports.AutorrelatoFolgaService = AutorrelatoFolgaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        tenant_service_1.TenantService,
        whatsapp_notifications_service_1.WhatsappNotificationsService])
], AutorrelatoFolgaService);
//# sourceMappingURL=autorrelato-folga.service.js.map