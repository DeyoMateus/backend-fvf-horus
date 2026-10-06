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
exports.DossieCobrancaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma/prisma.service");
const fuso_brasil_util_1 = require("../common/fuso/fuso-brasil.util");
let DossieCobrancaService = class DossieCobrancaService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listar(grupoId, inicio, fim, motoristaId) {
        const alertas = await this.prisma.alertaJornada.findMany({
            where: {
                tipo: client_1.TipoAlertaJornada.ESPERA_LIMITE_LEGAL_ATINGIDO,
                motorista: {
                    empresa: { grupoId },
                    ...(motoristaId ? { id: motoristaId } : {}),
                },
                createdAt: { gte: inicio, lte: fim },
            },
            include: { motorista: { select: { id: true, nome: true, cpf: true } } },
            orderBy: { createdAt: 'asc' },
        });
        const linhaPorMotorista = await this.linhasDeFuso(alertas);
        return alertas
            .map((alerta) => {
            const dossie = alerta.detalhes
                ?.dossieDeCobranca;
            if (!dossie)
                return null;
            const linha = linhaPorMotorista.get(alerta.motorista.id) ?? [];
            const offEm = (iso) => (0, fuso_brasil_util_1.offsetNoInstante)(linha, new Date(iso).getTime());
            return {
                alertaId: alerta.id,
                motoristaId: alerta.motorista.id,
                motoristaNome: alerta.motorista.nome,
                motoristaCpf: alerta.motorista.cpf,
                periodoInicio: dossie.periodoInicio,
                periodoFim: dossie.periodoFim,
                minutosTotais: dossie.minutosTotais,
                intervalos: dossie.intervalos.map((i) => ({
                    ...i,
                    fusoInicioMin: offEm(i.inicio),
                    fusoFimMin: offEm(i.fim),
                })),
                fusoPeriodoInicioMin: offEm(dossie.periodoInicio),
                fusoPeriodoFimMin: offEm(dossie.periodoFim),
                fusoCriadoEmMin: offEm(alerta.createdAt),
                registroGeradorId: dossie.registroGeradorId,
                observacao: dossie.observacao,
                criadoEm: alerta.createdAt,
            };
        })
            .filter((item) => item !== null);
    }
    async linhasDeFuso(alertas) {
        const resultado = new Map();
        if (alertas.length === 0)
            return resultado;
        const ids = [...new Set(alertas.map((a) => a.motorista.id))];
        const instantes = alertas.flatMap((a) => {
            const d = a.detalhes
                ?.dossieDeCobranca;
            return [a.createdAt.getTime(), d?.periodoInicio ? new Date(d.periodoInicio).getTime() : NaN, d?.periodoFim ? new Date(d.periodoFim).getTime() : NaN].filter((n) => !Number.isNaN(n));
        });
        const margem = 7 * 24 * 3_600_000;
        const registros = await this.prisma.registroJornada.findMany({
            where: {
                motoristaId: { in: ids },
                timestampEvento: {
                    gte: new Date(Math.min(...instantes) - margem),
                    lte: new Date(Math.max(...instantes) + margem),
                },
            },
            select: { motoristaId: true, timestampEvento: true, fusoOffsetMin: true },
        });
        for (const id of ids) {
            resultado.set(id, (0, fuso_brasil_util_1.construirLinhaDoTempoFuso)(registros
                .filter((r) => r.motoristaId === id)
                .map((r) => ({
                t: r.timestampEvento.getTime(),
                offsetMin: r.fusoOffsetMin ?? null,
            })), []));
        }
        return resultado;
    }
};
exports.DossieCobrancaService = DossieCobrancaService;
exports.DossieCobrancaService = DossieCobrancaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DossieCobrancaService);
//# sourceMappingURL=dossie-cobranca.service.js.map