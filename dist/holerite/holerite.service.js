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
exports.HoleriteService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const fuso_brasil_util_1 = require("../common/fuso/fuso-brasil.util");
const LIMITE_JORNADA_NORMAL_DIARIA_MIN = 480;
const ADICIONAL_NOTURNO_INICIO_HORA = 22;
const ADICIONAL_NOTURNO_FIM_HORA = 5;
let HoleriteService = class HoleriteService {
    prisma;
    tenant;
    constructor(prisma, tenant) {
        this.prisma = prisma;
        this.tenant = tenant;
    }
    async calcular(motoristaId, dataInicio, dataFim, opcoes, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        const motoristaComRegra = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            select: {
                empresa: { select: { regraSindical: true, fusoHorario: true } },
            },
        });
        const regra = motoristaComRegra?.empresa.regraSindical ?? null;
        const fusoEmpresaOffsetMin = (0, fuso_brasil_util_1.offsetPadraoDaEmpresa)(motoristaComRegra?.empresa.fusoHorario);
        const dataInicioEfetiva = (0, fuso_brasil_util_1.inicioDePeriodoBrt)(dataInicio, fusoEmpresaOffsetMin);
        const dataFimEfetiva = (0, fuso_brasil_util_1.fimDePeriodoBrt)(dataFim, fusoEmpresaOffsetMin);
        const limiteJornadaNormalMin = regra?.limiteJornadaNormalMin ?? LIMITE_JORNADA_NORMAL_DIARIA_MIN;
        const [registros, tratamentos] = await Promise.all([
            this.prisma.registroJornada.findMany({
                where: {
                    motoristaId,
                    timestampEvento: { gte: dataInicioEfetiva, lte: dataFimEfetiva },
                },
                orderBy: { timestampEvento: 'asc' },
            }),
            this.prisma.tratamentoPonto.findMany({
                where: {
                    motoristaId,
                    timestampEvento: { gte: dataInicioEfetiva, lte: dataFimEfetiva },
                },
                orderBy: { timestampEvento: 'asc' },
            }),
        ]);
        const linhaFuso = await this.montarLinhaDoTempoFuso(motoristaId, registros, fusoEmpresaOffsetMin);
        const eventos = this.unificarEventos(registros, tratamentos);
        const eventosDetalhados = this.construirEventosDetalhados(registros, tratamentos, linhaFuso, fusoEmpresaOffsetMin);
        const intervalos = [
            ...this.calcularIntervalos(eventos, dataFimEfetiva),
            ...this.calcularIntervalosIndefinido(eventos, dataFimEfetiva),
        ];
        const dias = this.agruparPorDia(intervalos, limiteJornadaNormalMin, linhaFuso, fusoEmpresaOffsetMin);
        const totais = dias.reduce((acc, d) => ({
            direcaoMin: acc.direcaoMin + d.direcaoMin,
            esperaMin: acc.esperaMin + d.esperaMin,
            normalMin: acc.normalMin + d.normalMin,
            extraMin: acc.extraMin + d.extraMin,
            noturnoMin: acc.noturnoMin + d.noturnoMin,
            indefinidoMin: acc.indefinidoMin + d.indefinidoMin,
        }), {
            direcaoMin: 0,
            esperaMin: 0,
            normalMin: 0,
            extraMin: 0,
            noturnoMin: 0,
            indefinidoMin: 0,
        });
        return {
            motoristaId,
            periodoInicio: dataInicio,
            periodoFim: dataFim,
            opcoes,
            dias,
            eventos: eventosDetalhados,
            fusoEmpresaOffsetMin,
            totais,
            regraSindicalAplicada: regra ? { id: regra.id, nome: regra.nome } : null,
        };
    }
    async calcularEmLote(motoristaIds, dataInicio, dataFim, opcoes, grupoIdSolicitante) {
        const motoristas = await this.prisma.motorista.findMany({
            where: {
                empresa: { grupoId: grupoIdSolicitante },
                status: client_1.StatusMotorista.ATIVO,
                ...(motoristaIds && motoristaIds.length > 0
                    ? { id: { in: motoristaIds } }
                    : {}),
            },
            select: {
                id: true,
                nome: true,
                cpf: true,
                cnh: true,
                empresa: { select: { razaoSocial: true, cnpj: true } },
            },
            orderBy: { nome: 'asc' },
        });
        if (motoristaIds && motoristaIds.length > 0) {
            const encontrados = new Set(motoristas.map((m) => m.id));
            const faltando = motoristaIds.filter((id) => !encontrados.has(id));
            if (faltando.length > 0) {
                throw new common_1.ForbiddenException('Um ou mais motoristas não pertencem ao seu grupo ou não estão ativos.');
            }
        }
        const itens = [];
        for (const m of motoristas) {
            const resultado = await this.calcular(m.id, dataInicio, dataFim, opcoes, grupoIdSolicitante);
            itens.push({ motorista: m, empresa: m.empresa, resultado });
        }
        return itens;
    }
    async montarLinhaDoTempoFuso(motoristaId, registros, padraoMin) {
        const pontos = registros.map((r) => ({
            t: r.timestampEvento.getTime(),
            offsetMin: r.fusoOffsetMin ?? null,
        }));
        const distintos = new Set(pontos.map((p) => p.offsetMin ?? padraoMin));
        let amostras = [];
        if (distintos.size > 1) {
            const tempos = pontos.map((p) => p.t);
            const linhas = await this.prisma.amostraLocalizacao.findMany({
                where: {
                    motoristaId,
                    capturadoEm: {
                        gte: new Date(Math.min(...tempos)),
                        lte: new Date(Math.max(...tempos)),
                    },
                },
                select: { capturadoEm: true, longitude: true },
                orderBy: { capturadoEm: 'asc' },
            });
            amostras = linhas.map((a) => ({
                t: a.capturadoEm.getTime(),
                longitude: Number(a.longitude),
            }));
        }
        return (0, fuso_brasil_util_1.construirLinhaDoTempoFuso)(pontos, amostras, padraoMin);
    }
    unificarEventos(registros, tratamentos) {
        const eventos = [
            ...registros.map((r) => ({
                timestampEvento: r.timestampEvento,
                tipoEvento: r.tipoEvento,
                origemGestor: false,
            })),
            ...tratamentos.map((t) => ({
                timestampEvento: t.timestampEvento,
                tipoEvento: t.tipoEvento,
                origemGestor: true,
            })),
        ];
        eventos.sort((a, b) => a.timestampEvento.getTime() - b.timestampEvento.getTime());
        return eventos;
    }
    construirEventosDetalhados(registros, tratamentos, linhaFuso, padraoMin) {
        const eventos = [
            ...registros.map((r) => ({
                timestampEvento: r.timestampEvento,
                tipoEvento: r.tipoEvento,
                origemGestor: false,
                detalhe: r.observacao ?? null,
                latitude: r.latitude != null ? Number(r.latitude) : null,
                longitude: r.longitude != null ? Number(r.longitude) : null,
                fusoOffsetMin: r.fusoOffsetMin ?? padraoMin,
            })),
            ...tratamentos.map((t) => ({
                timestampEvento: t.timestampEvento,
                tipoEvento: t.tipoEvento,
                origemGestor: true,
                detalhe: t.motivo,
                latitude: null,
                longitude: null,
                fusoOffsetMin: t.fusoOffsetMin ??
                    (0, fuso_brasil_util_1.offsetNoInstante)(linhaFuso, t.timestampEvento.getTime(), padraoMin),
            })),
        ];
        eventos.sort((a, b) => a.timestampEvento.getTime() - b.timestampEvento.getTime());
        return eventos;
    }
    calcularIntervalos(eventos, fimAbertoFallback) {
        const intervalos = [];
        const pares = [
            {
                categoria: 'DIRECAO',
                inicio: 'INICIO_DIRECAO',
                fins: new Set(['FIM_DIRECAO']),
            },
            {
                categoria: 'ESPERA',
                inicio: 'ESPERA_CARGA_DESCARGA',
                fins: new Set(['FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO']),
            },
        ];
        for (const par of pares) {
            let aberto = null;
            for (const evento of eventos) {
                if (evento.tipoEvento === par.inicio) {
                    aberto = {
                        inicio: evento.timestampEvento,
                        origemGestor: evento.origemGestor,
                    };
                }
                else if (par.fins.has(evento.tipoEvento) && aberto) {
                    intervalos.push({
                        categoria: par.categoria,
                        inicio: aberto.inicio,
                        fim: evento.timestampEvento,
                        origemGestor: aberto.origemGestor || evento.origemGestor,
                        emAberto: false,
                    });
                    aberto = null;
                }
            }
            if (aberto) {
                const limiteMaximoAberto = new Date(aberto.inicio.getTime() + 24 * 60 * 60 * 1000);
                const fimEfetivo = fimAbertoFallback < limiteMaximoAberto
                    ? fimAbertoFallback
                    : limiteMaximoAberto;
                intervalos.push({
                    categoria: par.categoria,
                    inicio: aberto.inicio,
                    fim: fimEfetivo,
                    origemGestor: aberto.origemGestor,
                    emAberto: true,
                });
            }
        }
        return intervalos;
    }
    calcularIntervalosIndefinido(eventos, fimAbertoFallback) {
        const ABRE_INDEFINIDO = new Set([
            'INICIO_JORNADA',
            'FIM_DIRECAO',
            'FIM_DESCANSO',
            'FIM_ESPERA_CARGA_DESCARGA',
            'FIM_DESCARREGAMENTO',
        ]);
        const FECHA_INDEFINIDO = new Set([
            'INICIO_DIRECAO',
            'INICIO_DESCANSO',
            'ESPERA_CARGA_DESCARGA',
            'OUTRO',
        ]);
        const intervalos = [];
        let aberto = null;
        for (const evento of eventos) {
            if (ABRE_INDEFINIDO.has(evento.tipoEvento)) {
                aberto = {
                    inicio: evento.timestampEvento,
                    origemGestor: evento.origemGestor,
                };
            }
            else if (FECHA_INDEFINIDO.has(evento.tipoEvento) && aberto) {
                intervalos.push({
                    categoria: 'INDEFINIDO',
                    inicio: aberto.inicio,
                    fim: evento.timestampEvento,
                    origemGestor: aberto.origemGestor || evento.origemGestor,
                    emAberto: false,
                });
                aberto = null;
            }
            else if (evento.tipoEvento === 'FIM_JORNADA') {
                if (aberto) {
                    intervalos.push({
                        categoria: 'INDEFINIDO',
                        inicio: aberto.inicio,
                        fim: evento.timestampEvento,
                        origemGestor: aberto.origemGestor || evento.origemGestor,
                        emAberto: false,
                    });
                }
                aberto = null;
            }
        }
        if (aberto) {
            const limiteMaximoAberto = new Date(aberto.inicio.getTime() + 24 * 60 * 60 * 1000);
            const fimEfetivo = fimAbertoFallback < limiteMaximoAberto
                ? fimAbertoFallback
                : limiteMaximoAberto;
            intervalos.push({
                categoria: 'INDEFINIDO',
                inicio: aberto.inicio,
                fim: fimEfetivo,
                origemGestor: aberto.origemGestor,
                emAberto: true,
            });
        }
        return intervalos;
    }
    agruparPorDia(intervalos, limiteJornadaNormalMin, linhaFuso, padraoMin) {
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
                    teveFechamentoGestor: false,
                };
                porDia.set(chave, d);
            }
            return d;
        };
        for (const intervalo of intervalos) {
            if (intervalo.emAberto)
                continue;
            for (const pedaco of (0, fuso_brasil_util_1.dividirPorDiaCivil)(intervalo.inicio, intervalo.fim, linhaFuso, padraoMin)) {
                const chave = (0, fuso_brasil_util_1.chaveDiaBrt)(pedaco.inicio, pedaco.offsetMin);
                const dia = obterDia(chave);
                const minutos = (pedaco.fim.getTime() - pedaco.inicio.getTime()) / 60000;
                if (intervalo.categoria === 'DIRECAO')
                    dia.direcaoMin += minutos;
                else if (intervalo.categoria === 'ESPERA')
                    dia.esperaMin += minutos;
                else
                    dia.indefinidoMin += minutos;
                if (intervalo.categoria !== 'INDEFINIDO') {
                    dia.noturnoMin += (0, fuso_brasil_util_1.minutosNoturnosEntre)(pedaco.inicio, pedaco.fim, pedaco.offsetMin, ADICIONAL_NOTURNO_INICIO_HORA, ADICIONAL_NOTURNO_FIM_HORA);
                }
                if (intervalo.origemGestor)
                    dia.teveFechamentoGestor = true;
            }
        }
        for (const dia of porDia.values()) {
            dia.direcaoMin = Math.round(dia.direcaoMin);
            dia.esperaMin = Math.round(dia.esperaMin);
            dia.noturnoMin = Math.round(dia.noturnoMin);
            dia.indefinidoMin = Math.round(dia.indefinidoMin);
            dia.normalMin = Math.min(dia.direcaoMin, limiteJornadaNormalMin);
            dia.extraMin = Math.max(0, dia.direcaoMin - limiteJornadaNormalMin);
        }
        return Array.from(porDia.values()).sort((a, b) => a.dia.localeCompare(b.dia));
    }
};
exports.HoleriteService = HoleriteService;
exports.HoleriteService = HoleriteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tenant_service_1.TenantService])
], HoleriteService);
//# sourceMappingURL=holerite.service.js.map