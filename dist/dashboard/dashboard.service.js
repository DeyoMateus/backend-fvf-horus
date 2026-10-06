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
exports.DashboardService = exports.TIPOS_ALERTA_RISCO_FRAUDE = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma/prisma.service");
const fuso_brasil_util_1 = require("../common/fuso/fuso-brasil.util");
exports.TIPOS_ALERTA_RISCO_FRAUDE = [
    client_1.TipoAlertaJornada.OCIOSIDADE_DIRECAO_SUSPEITA,
    client_1.TipoAlertaJornada.VELOCIDADE_IMPOSSIVEL_ENTRE_REGISTROS,
    client_1.TipoAlertaJornada.RELOGIO_DISPOSITIVO_SUSPEITO,
    client_1.TipoAlertaJornada.SEQUENCIA_JORNADA_MUITO_RAPIDA,
    client_1.TipoAlertaJornada.ODOMETRO_REGRESSIVO,
    client_1.TipoAlertaJornada.INTEGRIDADE_DISPOSITIVO_SUSPEITA,
    client_1.TipoAlertaJornada.INTEGRIDADE_CADEIA_VIOLADA,
];
const HORAS_JORNADA_ABERTA_ALERTA = 16;
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resumo(grupoId) {
        const agora = new Date();
        const inicio24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
        const inicio7d = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
        const [totalMotoristasAtivos, estadosAtuais, alertasAbertosPorSeveridade, alertas24h, riscoFraude7d, topTipos7d, empresaReferencia,] = await Promise.all([
            this.prisma.motorista.count({
                where: { empresa: { grupoId }, status: client_1.StatusMotorista.ATIVO },
            }),
            this.estadoAtualPorMotorista(grupoId),
            this.prisma.alertaJornada.groupBy({
                by: ['severidade'],
                where: { motorista: { empresa: { grupoId } }, visualizadoEm: null },
                _count: { severidade: true },
            }),
            this.prisma.alertaJornada.count({
                where: {
                    motorista: { empresa: { grupoId } },
                    createdAt: { gte: inicio24h },
                },
            }),
            this.prisma.alertaJornada.count({
                where: {
                    motorista: { empresa: { grupoId } },
                    tipo: { in: exports.TIPOS_ALERTA_RISCO_FRAUDE },
                    createdAt: { gte: inicio7d },
                },
            }),
            this.prisma.alertaJornada.groupBy({
                by: ['tipo'],
                where: {
                    motorista: { empresa: { grupoId } },
                    createdAt: { gte: inicio7d },
                },
                _count: { tipo: true },
                orderBy: { _count: { tipo: 'desc' } },
                take: 5,
            }),
            this.prisma.empresa.findFirst({
                where: { grupoId },
                orderBy: { createdAt: 'asc' },
                select: { fusoHorario: true },
            }),
        ]);
        const contagemEstados = {
            emDirecao: 0,
            emDescanso: 0,
            emEspera: 0,
            jornadaAbertaSemSubEvento: 0,
            semJornadaAberta: 0,
        };
        const jornadasAbertasHaMuitoTempo = [];
        for (const linha of estadosAtuais) {
            switch (linha.tipoEvento) {
                case 'INICIO_DIRECAO':
                    contagemEstados.emDirecao++;
                    break;
                case 'INICIO_DESCANSO':
                    contagemEstados.emDescanso++;
                    break;
                case 'ESPERA_CARGA_DESCARGA':
                    contagemEstados.emEspera++;
                    break;
                case 'FIM_JORNADA':
                    contagemEstados.semJornadaAberta++;
                    break;
                default:
                    contagemEstados.jornadaAbertaSemSubEvento++;
            }
        }
        const jornadasEmAberto = await this.jornadasEmAbertoComInicio(grupoId);
        for (const j of jornadasEmAberto) {
            const horasAberta = (agora.getTime() - j.inicioJornada.getTime()) / 3_600_000;
            if (horasAberta >= HORAS_JORNADA_ABERTA_ALERTA) {
                jornadasAbertasHaMuitoTempo.push({
                    motoristaId: j.motoristaId,
                    nome: j.nome,
                    desde: j.inicioJornada,
                    horasAberta: Math.round(horasAberta * 10) / 10,
                });
            }
        }
        const motoristasComRegistro = estadosAtuais.length;
        const abertosPorSeveridade = { CRITICO: 0, ATENCAO: 0, INFO: 0 };
        for (const grupo of alertasAbertosPorSeveridade) {
            abertosPorSeveridade[grupo.severidade] = grupo._count.severidade;
        }
        return {
            atualizadoEm: agora.toISOString(),
            fusoHorario: empresaReferencia?.fusoHorario ?? 'America/Sao_Paulo',
            motoristas: {
                totalAtivos: totalMotoristasAtivos,
                semNenhumRegistro: Math.max(0, totalMotoristasAtivos - motoristasComRegistro),
                emDirecao: contagemEstados.emDirecao,
                emDescanso: contagemEstados.emDescanso,
                emEspera: contagemEstados.emEspera,
                jornadaAbertaSemSubEvento: contagemEstados.jornadaAbertaSemSubEvento,
                semJornadaAberta: contagemEstados.semJornadaAberta,
                jornadasAbertasHaMuitoTempo: jornadasAbertasHaMuitoTempo.sort((a, b) => b.horasAberta - a.horasAberta),
            },
            alertas: {
                abertos: abertosPorSeveridade,
                totalAbertos: abertosPorSeveridade.CRITICO +
                    abertosPorSeveridade.ATENCAO +
                    abertosPorSeveridade.INFO,
                ultimas24h: alertas24h,
                riscoFraudeUltimos7d: riscoFraude7d,
                topTipos7d: topTipos7d.map((t) => ({
                    tipo: t.tipo,
                    quantidade: t._count.tipo,
                })),
            },
        };
    }
    async detalheCard(grupoId, card) {
        switch (card) {
            case 'ativos': {
                const motoristas = await this.prisma.motorista.findMany({
                    where: { empresa: { grupoId }, status: client_1.StatusMotorista.ATIVO },
                    select: { id: true, nome: true },
                    orderBy: { nome: 'asc' },
                });
                return {
                    tipo: 'motoristas',
                    itens: motoristas.map((m) => ({
                        motoristaId: m.id,
                        nome: m.nome,
                        detalhe: null,
                    })),
                };
            }
            case 'em-direcao':
            case 'em-descanso':
            case 'em-espera':
            case 'jornada-aberta-sem-sub-evento':
            case 'sem-jornada-aberta': {
                const tipoPorCard = {
                    'em-direcao': ['INICIO_DIRECAO'],
                    'em-descanso': ['INICIO_DESCANSO'],
                    'em-espera': ['ESPERA_CARGA_DESCARGA'],
                    'sem-jornada-aberta': ['FIM_JORNADA'],
                    'jornada-aberta-sem-sub-evento': [
                        'INICIO_JORNADA',
                        'FIM_DIRECAO',
                        'FIM_DESCANSO',
                        'FIM_ESPERA_CARGA_DESCARGA',
                        'FIM_DESCARREGAMENTO',
                    ],
                };
                const tiposAlvo = new Set(tipoPorCard[card]);
                const estadosAtuais = await this.estadoAtualPorMotorista(grupoId);
                const filtrados = estadosAtuais.filter((l) => tiposAlvo.has(l.tipoEvento));
                const agora = new Date();
                const direcaoContinua = card === 'em-direcao'
                    ? await this.direcaoContinuaPorMotorista(filtrados.map((l) => l.motoristaId), agora)
                    : new Map();
                return {
                    tipo: 'motoristas',
                    itens: filtrados
                        .map((l) => ({
                        motoristaId: l.motoristaId,
                        nome: l.nome,
                        detalhe: card === 'jornada-aberta-sem-sub-evento'
                            ? `Tempo indefinido há ${this.formatarHorasMinutos((agora.getTime() - l.timestampEvento.getTime()) / 60000)} (desde ${(0, fuso_brasil_util_1.marcarHorario)(l.timestampEvento)})`
                            : card === 'em-direcao' && direcaoContinua.has(l.motoristaId)
                                ? `${l.tipoEvento} às ${(0, fuso_brasil_util_1.marcarHorario)(l.timestampEvento)} · ${this.descreverDirecaoContinua(direcaoContinua.get(l.motoristaId))}`
                                : `${l.tipoEvento} às ${(0, fuso_brasil_util_1.marcarHorario)(l.timestampEvento)}`,
                    }))
                        .sort((a, b) => a.nome.localeCompare(b.nome)),
                };
            }
            case 'sem-nenhum-registro': {
                const [ativos, estadosAtuais] = await Promise.all([
                    this.prisma.motorista.findMany({
                        where: { empresa: { grupoId }, status: client_1.StatusMotorista.ATIVO },
                        select: { id: true, nome: true },
                    }),
                    this.estadoAtualPorMotorista(grupoId),
                ]);
                const comRegistro = new Set(estadosAtuais.map((l) => l.motoristaId));
                const semRegistro = ativos.filter((m) => !comRegistro.has(m.id));
                return {
                    tipo: 'motoristas',
                    itens: semRegistro
                        .map((m) => ({ motoristaId: m.id, nome: m.nome, detalhe: null }))
                        .sort((a, b) => a.nome.localeCompare(b.nome)),
                };
            }
            case 'alertas-criticos':
            case 'alertas-atencao': {
                const severidade = card === 'alertas-criticos'
                    ? client_1.SeveridadeAlerta.CRITICO
                    : client_1.SeveridadeAlerta.ATENCAO;
                const alertas = await this.prisma.alertaJornada.findMany({
                    where: {
                        motorista: { empresa: { grupoId } },
                        visualizadoEm: null,
                        severidade,
                    },
                    include: { motorista: { select: { id: true, nome: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 200,
                });
                return { tipo: 'alertas', itens: this.mapearAlertas(alertas) };
            }
            case 'alertas-24h': {
                const inicio24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const alertas = await this.prisma.alertaJornada.findMany({
                    where: {
                        motorista: { empresa: { grupoId } },
                        createdAt: { gte: inicio24h },
                    },
                    include: { motorista: { select: { id: true, nome: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 200,
                });
                return { tipo: 'alertas', itens: this.mapearAlertas(alertas) };
            }
            case 'risco-fraude-7d': {
                const inicio7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const alertas = await this.prisma.alertaJornada.findMany({
                    where: {
                        motorista: { empresa: { grupoId } },
                        tipo: { in: exports.TIPOS_ALERTA_RISCO_FRAUDE },
                        createdAt: { gte: inicio7d },
                    },
                    include: { motorista: { select: { id: true, nome: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 200,
                });
                return { tipo: 'alertas', itens: this.mapearAlertas(alertas) };
            }
            default:
                return { tipo: 'motoristas', itens: [] };
        }
    }
    mapearAlertas(alertas) {
        return alertas.map((a) => ({
            alertaId: a.id,
            motoristaId: a.motorista.id,
            nome: a.motorista.nome,
            tipo: a.tipo,
            severidade: a.severidade,
            createdAt: a.createdAt,
        }));
    }
    async tendencia(grupoId, opts) {
        const offGestor = (0, fuso_brasil_util_1.offsetValido)(opts.fusoOffsetMin)
            ? opts.fusoOffsetMin
            : -180;
        let diaInicio;
        let diaFimExclusivo;
        let diasClamped;
        if (opts.desde && opts.ate) {
            const diaInicioPedido = new Date(`${opts.desde}T00:00:00.000Z`);
            const diaFimPedido = new Date(`${opts.ate}T00:00:00.000Z`);
            if (Number.isNaN(diaInicioPedido.getTime()) ||
                Number.isNaN(diaFimPedido.getTime()) ||
                diaFimPedido < diaInicioPedido) {
                throw new common_1.BadRequestException('Período inválido (desde/ate)');
            }
            diaFimExclusivo = new Date(diaFimPedido.getTime() + 24 * 60 * 60 * 1000);
            const diasPedidos = Math.round((diaFimExclusivo.getTime() - diaInicioPedido.getTime()) /
                (24 * 60 * 60 * 1000));
            diasClamped = Math.min(Math.max(diasPedidos, 1), 180);
            diaInicio = new Date(diaFimExclusivo.getTime() - diasClamped * 24 * 60 * 60 * 1000);
        }
        else {
            diasClamped = Math.min(Math.max(opts.dias ?? 30, 1), 180);
            const hojeUtc = new Date((0, fuso_brasil_util_1.chaveDiaBrt)(new Date(), offGestor) + 'T00:00:00.000Z');
            diaInicio = new Date(hojeUtc.getTime() - (diasClamped - 1) * 24 * 60 * 60 * 1000);
            diaFimExclusivo = new Date(hojeUtc.getTime() + 24 * 60 * 60 * 1000);
        }
        const desde = diaInicio;
        const desdeInstante = new Date(desde.getTime() + fuso_brasil_util_1.OFFSET_BRT_MS);
        const fimExclusivoInstante = new Date(diaFimExclusivo.getTime() + fuso_brasil_util_1.OFFSET_BRT_MS);
        const desdeAlerta = new Date(desde.getTime() - offGestor * 60_000);
        const fimAlerta = new Date(diaFimExclusivo.getTime() - offGestor * 60_000);
        const desdeAmplo = new Date(desde.getTime() + 2 * 3_600_000);
        const fimAmplo = new Date(diaFimExclusivo.getTime() + 5 * 3_600_000);
        const [registrosPorDia, alertasPorDiaSeveridade, fraudePorDia, horasPorDia,] = await Promise.all([
            this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT date_trunc('day', r."timestampEvento" + COALESCE(r."fusoOffsetMin", -180) * interval '1 minute') AS dia, COUNT(*)::int AS total
        FROM registros_jornada r
        JOIN motoristas m ON m.id = r."motoristaId"
        JOIN empresas emp ON emp.id = m."empresaId"
        WHERE emp."grupoId" = ${grupoId}
          AND r."timestampEvento" >= ${desdeAmplo}
          AND r."timestampEvento" < ${fimAmplo}
          AND date_trunc('day', r."timestampEvento" + COALESCE(r."fusoOffsetMin", -180) * interval '1 minute') >= ${desde}
          AND date_trunc('day', r."timestampEvento" + COALESCE(r."fusoOffsetMin", -180) * interval '1 minute') < ${diaFimExclusivo}
        GROUP BY 1
        ORDER BY 1
      `),
            this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT date_trunc('day', a."createdAt" + ${offGestor}::int * interval '1 minute') AS dia, a.severidade, COUNT(*)::int AS total
        FROM alertas_jornada a
        JOIN motoristas m ON m.id = a."motoristaId"
        JOIN empresas emp ON emp.id = m."empresaId"
        WHERE emp."grupoId" = ${grupoId}
          AND a."createdAt" >= ${desdeAlerta}
          AND a."createdAt" < ${fimAlerta}
        GROUP BY 1, 2
        ORDER BY 1
      `),
            this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT date_trunc('day', a."createdAt" + ${offGestor}::int * interval '1 minute') AS dia, COUNT(*)::int AS total
        FROM alertas_jornada a
        JOIN motoristas m ON m.id = a."motoristaId"
        JOIN empresas emp ON emp.id = m."empresaId"
        WHERE emp."grupoId" = ${grupoId}
          AND a."createdAt" >= ${desdeAlerta}
          AND a."createdAt" < ${fimAlerta}
          AND a.tipo::text IN (${client_1.Prisma.join(exports.TIPOS_ALERTA_RISCO_FRAUDE)})
        GROUP BY 1
        ORDER BY 1
      `),
            this.prisma.$queryRaw(client_1.Prisma.sql `
        WITH eventos_brutos AS (
          SELECT r."motoristaId", r."tipoEvento", r."timestampEvento", r."fusoOffsetMin"
          FROM registros_jornada r
          JOIN motoristas m ON m.id = r."motoristaId"
          JOIN empresas emp ON emp.id = m."empresaId"
          WHERE emp."grupoId" = ${grupoId} AND r."tipoEvento" != 'OUTRO'
          UNION ALL
          SELECT t."motoristaId", t."tipoEvento", t."timestampEvento", NULL::int AS "fusoOffsetMin"
          FROM tratamentos_ponto t
          JOIN motoristas m ON m.id = t."motoristaId"
          JOIN empresas emp ON emp.id = m."empresaId"
          WHERE emp."grupoId" = ${grupoId} AND t."tipoEvento" != 'OUTRO'
        ),
        eventos AS (
          -- Exclui OUTRO da sequência ANTES do LAG: uma anotação livre
          -- batida no meio de um trecho de direção não pode "quebrar" o
          -- par início/fim (senão o LAG do FIM_DIRECAO aponta pro OUTRO
          -- em vez do INICIO_DIRECAO de verdade, e o trecho some da
          -- soma de horas por engano). Mesmo critério do app mobile
          -- (ultimoTipoEventoRelevanteRegistrado). Já filtrado lá em
          -- cima, em eventos_brutos, pras duas origens igual.
          SELECT
            "tipoEvento",
            "timestampEvento",
            LAG("tipoEvento") OVER (PARTITION BY "motoristaId" ORDER BY "timestampEvento") AS tipo_anterior,
            LAG("timestampEvento") OVER (PARTITION BY "motoristaId" ORDER BY "timestampEvento") AS tempo_anterior,
            LAG("fusoOffsetMin") OVER (PARTITION BY "motoristaId" ORDER BY "timestampEvento") AS fuso_anterior
          FROM eventos_brutos
        )
        SELECT
          date_trunc('day', tempo_anterior + COALESCE(fuso_anterior, -180) * interval '1 minute') AS dia,
          SUM(CASE WHEN "tipoEvento" = 'FIM_DIRECAO' AND tipo_anterior = 'INICIO_DIRECAO'
              THEN EXTRACT(EPOCH FROM ("timestampEvento" - tempo_anterior)) / 60.0 ELSE 0 END) AS minutos_direcao,
          SUM(CASE WHEN "tipoEvento" IN ('FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO') AND tipo_anterior = 'ESPERA_CARGA_DESCARGA'
              THEN EXTRACT(EPOCH FROM ("timestampEvento" - tempo_anterior)) / 60.0 ELSE 0 END) AS minutos_espera,
          -- Rodada 68 , "tempo indefinido": fechou uma etapa (ou bateu
          -- Início de jornada) e o próximo evento de verdade só veio
          -- depois. Mesma limitação de OUTRO já documentada acima (fica
          -- de fora da sequência antes do LAG) se aplica aqui: uma
          -- "aguardando documentação" no meio do intervalo não separa
          -- esse tempo do indefinido , aceito, mesmo critério de sempre.
          SUM(CASE WHEN "tipoEvento" IN ('INICIO_DIRECAO', 'INICIO_DESCANSO', 'ESPERA_CARGA_DESCARGA', 'FIM_JORNADA')
                AND tipo_anterior IN ('INICIO_JORNADA', 'FIM_DIRECAO', 'FIM_DESCANSO', 'FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO')
              THEN EXTRACT(EPOCH FROM ("timestampEvento" - tempo_anterior)) / 60.0 ELSE 0 END) AS minutos_indefinido
        FROM eventos
        WHERE tempo_anterior IS NOT NULL
          AND tempo_anterior >= ${desdeAmplo}
          AND tempo_anterior < ${fimAmplo}
          AND date_trunc('day', tempo_anterior + COALESCE(fuso_anterior, -180) * interval '1 minute') >= ${desde}
          AND date_trunc('day', tempo_anterior + COALESCE(fuso_anterior, -180) * interval '1 minute') < ${diaFimExclusivo}
        GROUP BY 1
        ORDER BY 1
      `),
        ]);
        const porDia = new Map();
        for (let i = 0; i < diasClamped; i++) {
            const d = new Date(desde.getTime() + i * 24 * 60 * 60 * 1000);
            const chave = d.toISOString().slice(0, 10);
            porDia.set(chave, {
                dia: chave,
                registros: 0,
                alertasCritico: 0,
                alertasAtencao: 0,
                alertasInfo: 0,
                riscoFraude: 0,
                horasDirecao: 0,
                horasEspera: 0,
                horasIndefinido: 0,
            });
        }
        const chaveDia = (d) => d.toISOString().slice(0, 10);
        for (const l of registrosPorDia) {
            const linha = porDia.get(chaveDia(l.dia));
            if (linha)
                linha.registros = Number(l.total);
        }
        for (const l of alertasPorDiaSeveridade) {
            const linha = porDia.get(chaveDia(l.dia));
            if (!linha)
                continue;
            if (l.severidade === 'CRITICO')
                linha.alertasCritico = Number(l.total);
            else if (l.severidade === 'ATENCAO')
                linha.alertasAtencao = Number(l.total);
            else
                linha.alertasInfo = Number(l.total);
        }
        for (const l of fraudePorDia) {
            const linha = porDia.get(chaveDia(l.dia));
            if (linha)
                linha.riscoFraude = Number(l.total);
        }
        for (const l of horasPorDia) {
            const linha = porDia.get(chaveDia(l.dia));
            if (!linha)
                continue;
            linha.horasDirecao =
                Math.round(((l.minutos_direcao ?? 0) / 60) * 10) / 10;
            linha.horasEspera = Math.round(((l.minutos_espera ?? 0) / 60) * 10) / 10;
            linha.horasIndefinido =
                Math.round(((l.minutos_indefinido ?? 0) / 60) * 10) / 10;
        }
        return Array.from(porDia.values());
    }
    async tendenciaDetalhe(grupoId, dia, indicador, fusoOffsetMin) {
        const diaCivil = new Date(`${dia}T00:00:00.000Z`);
        if (Number.isNaN(diaCivil.getTime())) {
            return { tipo: 'registros', itens: [] };
        }
        const offGestor = (0, fuso_brasil_util_1.offsetValido)(fusoOffsetMin) ? fusoOffsetMin : -180;
        const inicioAmplo = new Date(diaCivil.getTime() + 2 * 3_600_000);
        const fimAmplo = new Date(diaCivil.getTime() + 24 * 3_600_000 + 5 * 3_600_000);
        const inicioDia = new Date(diaCivil.getTime() - offGestor * 60_000);
        const fimDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);
        switch (indicador) {
            case 'registros': {
                const registros = await this.prisma.registroJornada.findMany({
                    where: {
                        motorista: { empresa: { grupoId } },
                        timestampEvento: { gte: inicioAmplo, lt: fimAmplo },
                    },
                    include: { motorista: { select: { id: true, nome: true } } },
                    orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
                    take: 600,
                });
                const doDia = registros.filter((r) => (0, fuso_brasil_util_1.chaveDiaBrt)(r.timestampEvento, r.fusoOffsetMin ?? -180) === dia);
                return {
                    tipo: 'registros',
                    itens: doDia.map((r) => ({
                        registroId: r.id,
                        motoristaId: r.motorista.id,
                        nome: r.motorista.nome,
                        tipoEvento: r.tipoEvento,
                        timestampEvento: r.timestampEvento,
                    })),
                };
            }
            case 'alertasCritico':
            case 'alertasAtencao':
            case 'alertasInfo': {
                const severidade = indicador === 'alertasCritico'
                    ? client_1.SeveridadeAlerta.CRITICO
                    : indicador === 'alertasAtencao'
                        ? client_1.SeveridadeAlerta.ATENCAO
                        : client_1.SeveridadeAlerta.INFO;
                const alertas = await this.prisma.alertaJornada.findMany({
                    where: {
                        motorista: { empresa: { grupoId } },
                        severidade,
                        createdAt: { gte: inicioDia, lt: fimDia },
                    },
                    include: { motorista: { select: { id: true, nome: true } } },
                    orderBy: { createdAt: 'asc' },
                    take: 300,
                });
                return { tipo: 'alertas', itens: this.mapearAlertas(alertas) };
            }
            case 'riscoFraude': {
                const alertas = await this.prisma.alertaJornada.findMany({
                    where: {
                        motorista: { empresa: { grupoId } },
                        tipo: { in: exports.TIPOS_ALERTA_RISCO_FRAUDE },
                        createdAt: { gte: inicioDia, lt: fimDia },
                    },
                    include: { motorista: { select: { id: true, nome: true } } },
                    orderBy: { createdAt: 'asc' },
                    take: 300,
                });
                return { tipo: 'alertas', itens: this.mapearAlertas(alertas) };
            }
            case 'horasDirecao':
            case 'horasEspera':
            case 'horasIndefinido': {
                const tipoFim = indicador === 'horasDirecao'
                    ? ['FIM_DIRECAO']
                    : indicador === 'horasEspera'
                        ? ['FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO']
                        : [
                            'INICIO_DIRECAO',
                            'INICIO_DESCANSO',
                            'ESPERA_CARGA_DESCARGA',
                            'FIM_JORNADA',
                        ];
                const tipoInicio = indicador === 'horasDirecao'
                    ? ['INICIO_DIRECAO']
                    : indicador === 'horasEspera'
                        ? ['ESPERA_CARGA_DESCARGA']
                        : [
                            'INICIO_JORNADA',
                            'FIM_DIRECAO',
                            'FIM_DESCANSO',
                            'FIM_ESPERA_CARGA_DESCARGA',
                            'FIM_DESCARREGAMENTO',
                        ];
                const trechos = await this.prisma.$queryRaw(client_1.Prisma.sql `
          WITH eventos_brutos AS (
            SELECT r."motoristaId", m.nome AS nome, r."tipoEvento", r."timestampEvento", r."fusoOffsetMin"
            FROM registros_jornada r
            JOIN motoristas m ON m.id = r."motoristaId"
            JOIN empresas emp ON emp.id = m."empresaId"
            WHERE emp."grupoId" = ${grupoId} AND r."tipoEvento" != 'OUTRO'
            UNION ALL
            SELECT t."motoristaId", m.nome AS nome, t."tipoEvento", t."timestampEvento", NULL::int AS "fusoOffsetMin"
            FROM tratamentos_ponto t
            JOIN motoristas m ON m.id = t."motoristaId"
            JOIN empresas emp ON emp.id = m."empresaId"
            WHERE emp."grupoId" = ${grupoId} AND t."tipoEvento" != 'OUTRO'
          ),
          eventos AS (
            SELECT
              "motoristaId",
              nome,
              "tipoEvento",
              "timestampEvento",
              LAG("tipoEvento") OVER (PARTITION BY "motoristaId" ORDER BY "timestampEvento") AS tipo_anterior,
              LAG("timestampEvento") OVER (PARTITION BY "motoristaId" ORDER BY "timestampEvento") AS tempo_anterior,
              LAG("fusoOffsetMin") OVER (PARTITION BY "motoristaId" ORDER BY "timestampEvento") AS fuso_anterior
            FROM eventos_brutos
          )
          SELECT "motoristaId", nome, tempo_anterior AS inicio, "timestampEvento" AS fim,
            EXTRACT(EPOCH FROM ("timestampEvento" - tempo_anterior)) / 60.0 AS minutos
          FROM eventos
          WHERE tempo_anterior IS NOT NULL
            AND tempo_anterior >= ${inicioAmplo} AND tempo_anterior < ${fimAmplo}
            AND date_trunc('day', tempo_anterior + COALESCE(fuso_anterior, -180) * interval '1 minute') = ${diaCivil}
            AND "tipoEvento"::text IN (${client_1.Prisma.join(tipoFim)})
            AND tipo_anterior::text IN (${client_1.Prisma.join(tipoInicio)})
          ORDER BY tempo_anterior ASC
        `);
                return {
                    tipo: 'trechos',
                    itens: trechos.map((t) => ({
                        motoristaId: t.motoristaId,
                        nome: t.nome,
                        inicio: t.inicio,
                        fim: t.fim,
                        minutos: Math.round(Number(t.minutos)),
                    })),
                };
            }
            default:
                return { tipo: 'registros', itens: [] };
        }
    }
    async estadoAtualPorMotorista(grupoId) {
        return this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT DISTINCT ON (r."motoristaId")
        r."motoristaId" AS "motoristaId",
        m.nome AS nome,
        r."tipoEvento"::text AS "tipoEvento",
        r."timestampEvento" AS "timestampEvento"
      FROM registros_jornada r
      JOIN motoristas m ON m.id = r."motoristaId"
      JOIN empresas emp ON emp.id = m."empresaId"
      WHERE emp."grupoId" = ${grupoId} AND m.status = ${client_1.StatusMotorista.ATIVO}::"StatusMotorista" AND r."tipoEvento" != 'OUTRO'
      ORDER BY r."motoristaId", r."timestampEvento" DESC, r.sequencial DESC
    `);
    }
    async jornadasEmAbertoComInicio(grupoId) {
        return this.prisma.$queryRaw(client_1.Prisma.sql `
      WITH ultimo_relevante AS (
        SELECT DISTINCT ON (r."motoristaId")
          r."motoristaId", r."tipoEvento", r.sequencial
        FROM registros_jornada r
        JOIN motoristas m ON m.id = r."motoristaId"
        JOIN empresas emp ON emp.id = m."empresaId"
        WHERE emp."grupoId" = ${grupoId} AND m.status = ${client_1.StatusMotorista.ATIVO}::"StatusMotorista" AND r."tipoEvento" != 'OUTRO'
        ORDER BY r."motoristaId", r."timestampEvento" DESC, r.sequencial DESC
      ),
      ultimo_inicio_jornada AS (
        SELECT DISTINCT ON (r."motoristaId")
          r."motoristaId", r."timestampEvento" AS "inicioJornada"
        FROM registros_jornada r
        WHERE r."tipoEvento" = 'INICIO_JORNADA'
        ORDER BY r."motoristaId", r."timestampEvento" DESC, r.sequencial DESC
      )
      SELECT m.id AS "motoristaId", m.nome AS nome, uij."inicioJornada" AS "inicioJornada"
      FROM ultimo_relevante ur
      JOIN motoristas m ON m.id = ur."motoristaId"
      JOIN ultimo_inicio_jornada uij ON uij."motoristaId" = ur."motoristaId"
      WHERE ur."tipoEvento" != 'FIM_JORNADA'
    `);
    }
    async direcaoContinuaPorMotorista(motoristaIds, agora) {
        const resultado = new Map();
        if (motoristaIds.length === 0)
            return resultado;
        const eventos = await this.prisma.registroJornada.findMany({
            where: { motoristaId: { in: motoristaIds } },
            select: { motoristaId: true, tipoEvento: true, timestampEvento: true },
            orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
        });
        const porMotorista = new Map();
        for (const e of eventos) {
            const lista = porMotorista.get(e.motoristaId) ?? [];
            lista.push(e);
            porMotorista.set(e.motoristaId, lista);
        }
        const PAUSA_QUALIFICADA_MS = 30 * 60000;
        for (const [motoristaId, todos] of porMotorista) {
            let idxInicio = 0;
            for (let i = todos.length - 1; i >= 0; i--) {
                if (todos[i].tipoEvento === 'INICIO_JORNADA') {
                    idxInicio = i;
                    break;
                }
            }
            const jornada = todos.slice(idxInicio);
            const intervalos = (tipoInicio, tipoFim) => {
                const lista = [];
                let aberto = null;
                for (const r of jornada) {
                    if (r.tipoEvento === tipoInicio)
                        aberto = r.timestampEvento.getTime();
                    else if (r.tipoEvento === tipoFim && aberto !== null) {
                        lista.push({ inicio: aberto, fim: r.timestampEvento.getTime() });
                        aberto = null;
                    }
                }
                if (aberto !== null)
                    lista.push({ inicio: aberto, fim: agora.getTime() });
                return lista;
            };
            const direcao = intervalos('INICIO_DIRECAO', 'FIM_DIRECAO');
            const pausas = intervalos('INICIO_DESCANSO', 'FIM_DESCANSO')
                .filter((p) => p.fim - p.inicio >= PAUSA_QUALIFICADA_MS)
                .sort((a, b) => b.fim - a.fim);
            const corte = pausas[0]?.fim ?? jornada[0].timestampEvento.getTime();
            const ms = direcao
                .filter((i) => i.fim > corte)
                .reduce((acc, i) => acc + (i.fim - Math.max(i.inicio, corte)), 0);
            resultado.set(motoristaId, ms / 60000);
        }
        return resultado;
    }
    descreverDirecaoContinua(minutos) {
        const tempo = this.formatarHorasMinutos(minutos);
        if (minutos >= 330) {
            return `Direção contínua há ${tempo} · CRÍTICO: limite de 05:30 excedido em ${this.formatarHorasMinutos(minutos - 330)}`;
        }
        if (minutos >= 300) {
            return `Direção contínua há ${tempo} · ATENÇÃO: faltam ${this.formatarHorasMinutos(330 - minutos)} para o limite de 05:30`;
        }
        return `Direção contínua há ${tempo} · Normal (atenção a partir de 05:00)`;
    }
    formatarHorasMinutos(minutos) {
        const totalMin = Math.max(0, Math.round(minutos));
        if (totalMin < 60)
            return `${totalMin} m`;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} h`;
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map