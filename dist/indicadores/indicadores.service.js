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
exports.IndicadoresService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const holerite_service_1 = require("../holerite/holerite.service");
const banco_horas_service_1 = require("../banco-horas/banco-horas.service");
const dashboard_service_1 = require("../dashboard/dashboard.service");
const fuso_brasil_util_1 = require("../common/fuso/fuso-brasil.util");
function bancoHorasVazio() {
    return {
        ativo: false,
        creditoExtraMin: 0,
        creditoCorrecaoMin: 0,
        debitoMin: 0,
        saldoMin: 0,
    };
}
function pct(parte, total) {
    if (total <= 0)
        return 0;
    return Math.round((parte / total) * 1000) / 10;
}
let IndicadoresService = class IndicadoresService {
    prisma;
    tenant;
    holerite;
    bancoHoras;
    constructor(prisma, tenant, holerite, bancoHoras) {
        this.prisma = prisma;
        this.tenant = tenant;
        this.holerite = holerite;
        this.bancoHoras = bancoHoras;
    }
    async painel(grupoId, dataInicio, dataFim, motoristaId) {
        if (motoristaId) {
            await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoId);
        }
        const motoristas = await this.prisma.motorista.findMany({
            where: {
                empresa: { grupoId },
                status: client_1.StatusMotorista.ATIVO,
                ...(motoristaId ? { id: motoristaId } : {}),
            },
            select: { id: true, nome: true },
            orderBy: { nome: 'asc' },
        });
        const opcoes = {
            direcaoEspera: true,
            normalExtra: true,
            adicionalNoturno: true,
        };
        const resultados = await Promise.all(motoristas.map((m) => this.holerite.calcular(m.id, dataInicio, dataFim, opcoes, grupoId)));
        const bancoHorasPorMotorista = await Promise.all(motoristas.map(async (m) => {
            const ativo = await this.bancoHoras.estaAtivoParaMotorista(m.id);
            if (!ativo)
                return {
                    ajustes: [],
                    info: bancoHorasVazio(),
                };
            const { creditoCorrecaoMin, debitoMin, ajustes } = await this.bancoHoras.ajustesDoPeriodo(m.id, dataInicio, dataFim);
            return {
                ajustes,
                info: {
                    ativo,
                    creditoExtraMin: 0,
                    creditoCorrecaoMin,
                    debitoMin,
                    saldoMin: 0,
                },
            };
        }));
        const alertas = await this.prisma.alertaJornada.findMany({
            where: {
                motorista: {
                    empresa: { grupoId },
                    ...(motoristaId ? { id: motoristaId } : {}),
                },
                createdAt: { gte: dataInicio, lte: dataFim },
            },
            select: {
                motoristaId: true,
                severidade: true,
                tipo: true,
                createdAt: true,
                motorista: { select: { empresa: { select: { fusoHorario: true } } } },
            },
        });
        const alertasVazios = () => ({
            total: 0,
            criticos: 0,
            atencao: 0,
            info: 0,
            riscoFraude: 0,
        });
        const alertasPorMotorista = new Map();
        const alertasPorDia = new Map();
        for (const a of alertas) {
            const bucket = alertasPorMotorista.get(a.motoristaId) ?? alertasVazios();
            bucket.total++;
            if (a.severidade === 'CRITICO')
                bucket.criticos++;
            else if (a.severidade === 'ATENCAO')
                bucket.atencao++;
            else
                bucket.info++;
            if (dashboard_service_1.TIPOS_ALERTA_RISCO_FRAUDE.includes(a.tipo))
                bucket.riscoFraude++;
            alertasPorMotorista.set(a.motoristaId, bucket);
            const chaveDia = (0, fuso_brasil_util_1.chaveDiaBrt)(a.createdAt, (0, fuso_brasil_util_1.offsetPadraoDaEmpresa)(a.motorista?.empresa?.fusoHorario));
            alertasPorDia.set(chaveDia, (alertasPorDia.get(chaveDia) ?? 0) + 1);
        }
        const motoristasIndicadores = resultados.map((r, i) => {
            const m = motoristas[i];
            const totalTrabalhado = r.totais.direcaoMin + r.totais.esperaMin;
            const totalJornadaRastreado = totalTrabalhado + r.totais.indefinidoMin;
            const a = alertasPorMotorista.get(m.id) ?? alertasVazios();
            const bh = bancoHorasPorMotorista[i].info;
            const bancoHorasFinal = bh.ativo
                ? {
                    ...bh,
                    creditoExtraMin: r.totais.extraMin,
                    saldoMin: r.totais.extraMin + bh.creditoCorrecaoMin - bh.debitoMin,
                }
                : bancoHorasVazio();
            return {
                motoristaId: m.id,
                nome: m.nome,
                direcaoMin: r.totais.direcaoMin,
                esperaMin: r.totais.esperaMin,
                normalMin: r.totais.normalMin,
                extraMin: r.totais.extraMin,
                noturnoMin: r.totais.noturnoMin,
                indefinidoMin: r.totais.indefinidoMin,
                alertas: a,
                percentualExtraSobreDirecao: pct(r.totais.extraMin, r.totais.direcaoMin),
                percentualEsperaSobreTotal: pct(r.totais.esperaMin, totalTrabalhado),
                percentualNoturnoSobreDirecao: pct(r.totais.noturnoMin, r.totais.direcaoMin),
                percentualIndefinidoSobreJornada: pct(r.totais.indefinidoMin, totalJornadaRastreado),
                bancoHoras: bancoHorasFinal,
            };
        });
        const totaisAcumulados = motoristasIndicadores.reduce((acc, m) => ({
            direcaoMin: acc.direcaoMin + m.direcaoMin,
            esperaMin: acc.esperaMin + m.esperaMin,
            normalMin: acc.normalMin + m.normalMin,
            extraMin: acc.extraMin + m.extraMin,
            noturnoMin: acc.noturnoMin + m.noturnoMin,
            indefinidoMin: acc.indefinidoMin + m.indefinidoMin,
        }), {
            direcaoMin: 0,
            esperaMin: 0,
            normalMin: 0,
            extraMin: 0,
            noturnoMin: 0,
            indefinidoMin: 0,
        });
        const alertasTotais = alertasVazios();
        for (const a of alertasPorMotorista.values()) {
            alertasTotais.total += a.total;
            alertasTotais.criticos += a.criticos;
            alertasTotais.atencao += a.atencao;
            alertasTotais.info += a.info;
            alertasTotais.riscoFraude += a.riscoFraude;
        }
        const motoristasComBancoHorasAtivo = motoristasIndicadores.filter((m) => m.bancoHoras.ativo).length;
        const bancoHorasTotais = motoristasIndicadores.reduce((acc, m) => ({
            ativo: acc.ativo || m.bancoHoras.ativo,
            creditoExtraMin: acc.creditoExtraMin + m.bancoHoras.creditoExtraMin,
            creditoCorrecaoMin: acc.creditoCorrecaoMin + m.bancoHoras.creditoCorrecaoMin,
            debitoMin: acc.debitoMin + m.bancoHoras.debitoMin,
            saldoMin: acc.saldoMin + m.bancoHoras.saldoMin,
        }), bancoHorasVazio());
        const porDia = new Map();
        const obterDia = (chave) => {
            let d = porDia.get(chave);
            if (!d) {
                d = {
                    dia: chave,
                    direcaoMin: 0,
                    esperaMin: 0,
                    normalMin: 0,
                    extraMin: 0,
                    noturnoMin: 0,
                    indefinidoMin: 0,
                    alertas: 0,
                    bancoHorasCreditoMin: 0,
                    bancoHorasDebitoMin: 0,
                    bancoHorasSaldoAcumuladoMin: 0,
                };
                porDia.set(chave, d);
            }
            return d;
        };
        for (const r of resultados) {
            for (const dia of r.dias) {
                const d = obterDia(dia.dia);
                d.direcaoMin += dia.direcaoMin;
                d.esperaMin += dia.esperaMin;
                d.normalMin += dia.normalMin;
                d.extraMin += dia.extraMin;
                d.noturnoMin += dia.noturnoMin;
                d.indefinidoMin += dia.indefinidoMin;
            }
        }
        for (const [chaveDia, qtd] of alertasPorDia.entries()) {
            obterDia(chaveDia).alertas += qtd;
        }
        for (let i = 0; i < motoristas.length; i++) {
            if (!bancoHorasPorMotorista[i].info.ativo)
                continue;
            for (const dia of resultados[i].dias) {
                obterDia(dia.dia).bancoHorasCreditoMin += dia.extraMin;
            }
            for (const ajuste of bancoHorasPorMotorista[i].ajustes) {
                const chaveDia = ajuste.data.toISOString().slice(0, 10);
                if (ajuste.tipo === client_1.TipoAjusteBancoHoras.CORRECAO_CREDITO) {
                    obterDia(chaveDia).bancoHorasCreditoMin += ajuste.minutos;
                }
                else {
                    obterDia(chaveDia).bancoHorasDebitoMin += ajuste.minutos;
                }
            }
        }
        const tendenciaDiaria = Array.from(porDia.values()).sort((a, b) => a.dia.localeCompare(b.dia));
        let saldoAcumulado = 0;
        for (const dia of tendenciaDiaria) {
            saldoAcumulado += dia.bancoHorasCreditoMin - dia.bancoHorasDebitoMin;
            dia.bancoHorasSaldoAcumuladoMin = saldoAcumulado;
        }
        const rankingHorasExtras = [...motoristasIndicadores]
            .filter((m) => m.extraMin > 0)
            .sort((a, b) => b.extraMin - a.extraMin)
            .slice(0, 10)
            .map((m) => ({
            motoristaId: m.motoristaId,
            nome: m.nome,
            valorMin: m.extraMin,
        }));
        const rankingTempoEspera = [...motoristasIndicadores]
            .filter((m) => m.esperaMin > 0)
            .sort((a, b) => b.esperaMin - a.esperaMin)
            .slice(0, 10)
            .map((m) => ({
            motoristaId: m.motoristaId,
            nome: m.nome,
            valorMin: m.esperaMin,
        }));
        const rankingTempoIndefinido = [...motoristasIndicadores]
            .filter((m) => m.indefinidoMin > 0)
            .sort((a, b) => b.indefinidoMin - a.indefinidoMin)
            .slice(0, 10)
            .map((m) => ({
            motoristaId: m.motoristaId,
            nome: m.nome,
            valorMin: m.indefinidoMin,
        }));
        return {
            periodoInicio: dataInicio.toISOString(),
            periodoFim: dataFim.toISOString(),
            motoristaFiltro: motoristaId ?? null,
            motoristas: motoristasIndicadores,
            totais: {
                ...totaisAcumulados,
                alertas: alertasTotais,
                percentualExtraSobreDirecao: pct(totaisAcumulados.extraMin, totaisAcumulados.direcaoMin),
                percentualEsperaSobreTotal: pct(totaisAcumulados.esperaMin, totaisAcumulados.direcaoMin + totaisAcumulados.esperaMin),
                percentualNoturnoSobreDirecao: pct(totaisAcumulados.noturnoMin, totaisAcumulados.direcaoMin),
                percentualIndefinidoSobreJornada: pct(totaisAcumulados.indefinidoMin, totaisAcumulados.direcaoMin +
                    totaisAcumulados.esperaMin +
                    totaisAcumulados.indefinidoMin),
                bancoHoras: bancoHorasTotais,
            },
            motoristasComBancoHorasAtivo,
            tendenciaDiaria,
            rankingHorasExtras,
            rankingTempoEspera,
            rankingTempoIndefinido,
        };
    }
    async exportarCsv(grupoId, dataInicio, dataFim, motoristaId) {
        if (motoristaId) {
            await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoId);
        }
        const motoristas = await this.prisma.motorista.findMany({
            where: {
                empresa: { grupoId },
                status: client_1.StatusMotorista.ATIVO,
                ...(motoristaId ? { id: motoristaId } : {}),
            },
            select: { id: true, nome: true },
            orderBy: { nome: 'asc' },
        });
        const opcoes = {
            direcaoEspera: true,
            normalExtra: true,
            adicionalNoturno: true,
        };
        const linhas = [
            'motorista,dia,horas_direcao,horas_espera,horas_normais,horas_extras,horas_adicional_noturno,horas_indefinido',
        ];
        const escaparCampo = (v) => `"${v.replace(/"/g, '""')}"`;
        const minParaHoras = (min) => (min / 60).toFixed(2);
        for (const m of motoristas) {
            const resultado = await this.holerite.calcular(m.id, dataInicio, dataFim, opcoes, grupoId);
            for (const dia of resultado.dias) {
                linhas.push([
                    escaparCampo(m.nome),
                    dia.dia,
                    minParaHoras(dia.direcaoMin),
                    minParaHoras(dia.esperaMin),
                    minParaHoras(dia.normalMin),
                    minParaHoras(dia.extraMin),
                    minParaHoras(dia.noturnoMin),
                    minParaHoras(dia.indefinidoMin),
                ].join(','));
            }
            linhas.push([
                escaparCampo(`${m.nome} (TOTAL)`),
                '',
                minParaHoras(resultado.totais.direcaoMin),
                minParaHoras(resultado.totais.esperaMin),
                minParaHoras(resultado.totais.normalMin),
                minParaHoras(resultado.totais.extraMin),
                minParaHoras(resultado.totais.noturnoMin),
                minParaHoras(resultado.totais.indefinidoMin),
            ].join(','));
        }
        return linhas.join('\n');
    }
};
exports.IndicadoresService = IndicadoresService;
exports.IndicadoresService = IndicadoresService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tenant_service_1.TenantService,
        holerite_service_1.HoleriteService,
        banco_horas_service_1.BancoHorasService])
], IndicadoresService);
//# sourceMappingURL=indicadores.service.js.map