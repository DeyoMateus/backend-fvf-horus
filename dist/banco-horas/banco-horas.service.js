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
exports.BancoHorasService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../common/audit/audit.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const holerite_service_1 = require("../holerite/holerite.service");
const TIPOS_DEBITO = [
    client_1.TipoAjusteBancoHoras.COMPENSACAO,
    client_1.TipoAjusteBancoHoras.PAGAMENTO,
    client_1.TipoAjusteBancoHoras.CORRECAO_DEBITO,
];
let BancoHorasService = class BancoHorasService {
    prisma;
    tenant;
    holerite;
    audit;
    constructor(prisma, tenant, holerite, audit) {
        this.prisma = prisma;
        this.tenant = tenant;
        this.holerite = holerite;
        this.audit = audit;
    }
    async estaAtivoParaMotorista(motoristaId) {
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            select: {
                empresa: {
                    select: { regraSindical: { select: { bancoHorasAtivo: true } } },
                },
            },
        });
        return motorista?.empresa.regraSindical?.bancoHorasAtivo ?? false;
    }
    async ajustesDoPeriodo(motoristaId, dataInicio, dataFim) {
        const ajustes = await this.prisma.ajusteBancoHoras.findMany({
            where: { motoristaId, data: { gte: dataInicio, lte: dataFim } },
            select: { data: true, tipo: true, minutos: true },
        });
        let creditoCorrecaoMin = 0;
        let debitoMin = 0;
        for (const a of ajustes) {
            if (a.tipo === client_1.TipoAjusteBancoHoras.CORRECAO_CREDITO)
                creditoCorrecaoMin += a.minutos;
            else if (TIPOS_DEBITO.includes(a.tipo))
                debitoMin += a.minutos;
        }
        return { creditoCorrecaoMin, debitoMin, ajustes };
    }
    async calcularSaldo(motoristaId, dataInicio, dataFim, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        const [ativo, resultadoHolerite, { creditoCorrecaoMin, debitoMin }] = await Promise.all([
            this.estaAtivoParaMotorista(motoristaId),
            this.holerite.calcular(motoristaId, dataInicio, dataFim, { direcaoEspera: true, normalExtra: true, adicionalNoturno: false }, grupoIdSolicitante),
            this.ajustesDoPeriodo(motoristaId, dataInicio, dataFim),
        ]);
        const creditoExtraMin = resultadoHolerite.totais.extraMin;
        return {
            ativo,
            creditoExtraMin,
            creditoCorrecaoMin,
            debitoMin,
            saldoMin: creditoExtraMin + creditoCorrecaoMin - debitoMin,
        };
    }
    async listarAjustes(motoristaId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        return this.prisma.ajusteBancoHoras.findMany({
            where: { motoristaId },
            include: {
                registradoPorUsuario: { select: { nome: true, email: true } },
            },
            orderBy: { data: 'desc' },
        });
    }
    async registrarAjuste(motoristaId, grupoIdSolicitante, usuarioId, dados) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        await this.tenant.verificarMotoristaAtivo(motoristaId);
        const ajuste = await this.prisma.ajusteBancoHoras.create({
            data: {
                motoristaId,
                tipo: dados.tipo,
                minutos: dados.minutos,
                data: dados.data,
                observacao: dados.observacao,
                registradoPorUsuarioId: usuarioId,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'BANCO_HORAS_AJUSTE_REGISTRADO',
            entidade: 'AjusteBancoHoras',
            entidadeId: ajuste.id,
            detalhes: { motoristaId, tipo: dados.tipo, minutos: dados.minutos },
        });
        return ajuste;
    }
};
exports.BancoHorasService = BancoHorasService;
exports.BancoHorasService = BancoHorasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tenant_service_1.TenantService,
        holerite_service_1.HoleriteService,
        audit_service_1.AuditService])
], BancoHorasService);
//# sourceMappingURL=banco-horas.service.js.map