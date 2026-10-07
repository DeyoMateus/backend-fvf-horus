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
var RegistrosJornadaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrosJornadaService = void 0;
const precisao_gps_util_1 = require("../common/hash-chain/precisao-gps.util");
const grupo_id_seguro_1 = require("../common/prisma/grupo-id-seguro");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const antifraude_service_1 = require("../common/antifraude/antifraude.service");
const jornada_legal_service_1 = require("../common/jornada-legal/jornada-legal.service");
const push_notifications_service_1 = require("../common/notifications/push-notifications.service");
const whatsapp_notifications_service_1 = require("../common/notifications/whatsapp-notifications.service");
const audit_service_1 = require("../common/audit/audit.service");
const envelope_encryption_service_1 = require("../common/crypto/envelope-encryption.service");
const hash_chain_service_1 = require("../common/hash-chain/hash-chain.service");
const relogio_confiavel_util_1 = require("../common/relogio-confiavel/relogio-confiavel.util");
const certificate_service_1 = require("../common/signature/certificate.service");
const signature_service_1 = require("../common/signature/signature.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const tenant_context_1 = require("../common/tenant/tenant-context");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const verificacao_agendada_service_1 = require("./verificacao-agendada.service");
const lote_registros_jornada_constants_1 = require("./lote-registros-jornada.constants");
const fuso_brasil_util_1 = require("../common/fuso/fuso-brasil.util");
let RegistrosJornadaService = class RegistrosJornadaService {
    static { RegistrosJornadaService_1 = this; }
    prisma;
    hashChain;
    crypto;
    certificados;
    assinaturas;
    audit;
    jornadaLegal;
    antifraude;
    pushNotifications;
    whatsapp;
    tenant;
    verificacaoAgendada;
    filaLote;
    static TOLERANCIA_RELOGIO_FUTURO_MIN = 10;
    static TOLERANCIA_DIVERGENCIA_RELOGIO_MONOTONICO_MIN = 5;
    constructor(prisma, hashChain, crypto, certificados, assinaturas, audit, jornadaLegal, antifraude, pushNotifications, whatsapp, tenant, verificacaoAgendada, filaLote) {
        this.prisma = prisma;
        this.hashChain = hashChain;
        this.crypto = crypto;
        this.certificados = certificados;
        this.assinaturas = assinaturas;
        this.audit = audit;
        this.jornadaLegal = jornadaLegal;
        this.antifraude = antifraude;
        this.pushNotifications = pushNotifications;
        this.whatsapp = whatsapp;
        this.tenant = tenant;
        this.verificacaoAgendada = verificacaoAgendada;
        this.filaLote = filaLote;
    }
    logger = new common_1.Logger(RegistrosJornadaService_1.name);
    queueEventsLote;
    obterQueueEventsLote() {
        if (!this.queueEventsLote) {
            this.queueEventsLote = new bullmq_2.QueueEvents(lote_registros_jornada_constants_1.FILA_LOTE_REGISTROS_JORNADA, {
                connection: {
                    host: process.env.REDIS_HOST ?? 'localhost',
                    port: Number(process.env.REDIS_PORT ?? 6379),
                    password: process.env.REDIS_PASSWORD || undefined,
                },
            });
            this.queueEventsLote.on('error', (err) => {
                this.logger.warn(`QueueEvents (lote de registros) reportou erro de conexão: ${err.message}`);
            });
        }
        return this.queueEventsLote;
    }
    async create(motoristaId, deviceUuidUsado, dto, ip, userAgent) {
        const alertasCriticosParaNotificar = [];
        let empresaIdParaNotificar;
        let alertaCteAbertoParaNotificar = null;
        const horaRecebimentoServidor = new Date();
        const registro = await this.prisma.$transaction(async (tx) => {
            const ctxTenant = tenant_context_1.TenantContext.atual();
            if (!ctxTenant) {
                throw new Error('create() de RegistroJornada sem contexto de tenant , ver TenantContextInterceptor.');
            }
            await tx.$executeRawUnsafe(`SET LOCAL app.grupo_atual = '${(0, grupo_id_seguro_1.grupoIdSeguro)(ctxTenant.grupoId)}'`);
            if (dto.idempotencyKey) {
                const existente = await tx.registroJornada.findUnique({
                    where: { idempotencyKey: dto.idempotencyKey },
                });
                if (existente)
                    return existente;
            }
            const motorista = await tx.motorista.findUnique({
                where: { id: motoristaId },
            });
            if (!motorista)
                throw new common_1.NotFoundException('Motorista não encontrado');
            empresaIdParaNotificar = motorista.empresaId;
            const ultimo = await tx.registroJornada.findFirst({
                where: { motoristaId },
                orderBy: { sequencial: 'desc' },
            });
            const timestampEventoNovo = new Date(dto.timestampEvento);
            let precisaRegistrarPendenciaRelogioConfiavel = false;
            const igualPermitido = !!ultimo &&
                timestampEventoNovo.getTime() === ultimo.timestampEvento.getTime() &&
                (dto.tipoEvento === client_1.TipoEvento.FIM_JORNADA ||
                    ultimo.tipoEvento === client_1.TipoEvento.INICIO_JORNADA);
            if (ultimo &&
                !igualPermitido &&
                timestampEventoNovo.getTime() <= ultimo.timestampEvento.getTime()) {
                await this.audit.registrar({
                    actorType: client_1.ActorType.MOTORISTA,
                    actorId: motoristaId,
                    acao: 'REGISTRO_REJEITADO_RELOGIO_RETROCEDIDO',
                    entidade: 'RegistroJornada',
                    detalhes: {
                        tipoEvento: dto.tipoEvento,
                        timestampEventoRecebido: dto.timestampEvento,
                        timestampUltimoRegistro: ultimo.timestampEvento,
                        deviceUuidUsado,
                    },
                    ip,
                    userAgent,
                });
                throw new common_1.BadRequestException('Não foi possível registrar: o horário deste evento é anterior (ou igual) ao seu último registro. ' +
                    'Verifique a data e a hora do aparelho (recomendado: horário automático da operadora) e tente novamente.');
            }
            const minutosNoFuturo = (timestampEventoNovo.getTime() - horaRecebimentoServidor.getTime()) /
                60000;
            if (minutosNoFuturo >
                RegistrosJornadaService_1.TOLERANCIA_RELOGIO_FUTURO_MIN) {
                await this.audit.registrar({
                    actorType: client_1.ActorType.MOTORISTA,
                    actorId: motoristaId,
                    acao: 'REGISTRO_REJEITADO_RELOGIO_ADIANTADO',
                    entidade: 'RegistroJornada',
                    detalhes: {
                        tipoEvento: dto.tipoEvento,
                        timestampEventoRecebido: dto.timestampEvento,
                        horaRecebimentoServidor,
                        minutosNoFuturo: Math.round(minutosNoFuturo),
                        deviceUuidUsado,
                    },
                    ip,
                    userAgent,
                });
                throw new common_1.BadRequestException('Não foi possível registrar: o relógio do aparelho parece estar adiantado em relação ao horário real. ' +
                    'Ajuste a data e a hora do celular (recomendado: horário automático da operadora) e tente novamente.');
            }
            if (ultimo &&
                ultimo.deviceUuidUsado === deviceUuidUsado &&
                ultimo.elapsedRealtimeMs != null &&
                dto.elapsedRealtimeMs != null &&
                dto.elapsedRealtimeMs >= ultimo.elapsedRealtimeMs) {
                const deltaParedeMs = timestampEventoNovo.getTime() - ultimo.timestampEvento.getTime();
                const deltaMonotonicoMs = dto.elapsedRealtimeMs - ultimo.elapsedRealtimeMs;
                const divergenciaMin = Math.abs(deltaParedeMs - deltaMonotonicoMs) / 60000;
                if (divergenciaMin >
                    RegistrosJornadaService_1.TOLERANCIA_DIVERGENCIA_RELOGIO_MONOTONICO_MIN) {
                    await this.audit.registrar({
                        actorType: client_1.ActorType.MOTORISTA,
                        actorId: motoristaId,
                        acao: 'REGISTRO_REJEITADO_RELOGIO_MONOTONICO_DIVERGENTE',
                        entidade: 'RegistroJornada',
                        detalhes: {
                            tipoEvento: dto.tipoEvento,
                            timestampEventoRecebido: dto.timestampEvento,
                            timestampUltimoRegistro: ultimo.timestampEvento,
                            deltaParedeMs,
                            deltaMonotonicoMs,
                            divergenciaMin: Math.round(divergenciaMin),
                            deviceUuidUsado,
                        },
                        ip,
                        userAgent,
                    });
                    throw new common_1.BadRequestException('Não foi possível registrar: o relógio deste aparelho parece ter sido alterado manualmente entre o ' +
                        'último ponto batido e agora. Ajuste a data e a hora do celular (recomendado: horário automático da ' +
                        'operadora) e tente novamente. Se isto não fizer sentido, contate a empresa.');
                }
            }
            if (dto.elapsedRealtimeMs != null) {
                const amostraHoraConfiavel = await tx.amostraHoraConfiavel.findFirst({
                    where: {
                        deviceUuidUsado,
                        elapsedRealtimeMsNoMomento: { lte: dto.elapsedRealtimeMs },
                    },
                    orderBy: { elapsedRealtimeMsNoMomento: 'desc' },
                });
                if (amostraHoraConfiavel) {
                    const divergenciaHoraConfiavelMin = (0, relogio_confiavel_util_1.calcularDivergenciaRelogioConfiavelMin)(timestampEventoNovo, dto.elapsedRealtimeMs, amostraHoraConfiavel);
                    if (divergenciaHoraConfiavelMin >
                        relogio_confiavel_util_1.TOLERANCIA_DIVERGENCIA_RELOGIO_CONFIAVEL_MIN) {
                        await this.audit.registrar({
                            actorType: client_1.ActorType.MOTORISTA,
                            actorId: motoristaId,
                            acao: 'REGISTRO_REJEITADO_RELOGIO_DIVERGENTE_DE_HORA_CONFIAVEL',
                            entidade: 'RegistroJornada',
                            detalhes: {
                                tipoEvento: dto.tipoEvento,
                                timestampEventoRecebido: dto.timestampEvento,
                                divergenciaMin: Math.round(divergenciaHoraConfiavelMin),
                                deviceUuidUsado,
                            },
                            ip,
                            userAgent,
                        });
                        throw new common_1.BadRequestException('Não foi possível registrar: comparando com a última vez que este aparelho confirmou a hora com o ' +
                            'servidor, o relógio dele parece ter sido alterado manualmente. Ajuste a data e a hora do celular ' +
                            '(recomendado: horário automático da operadora) e tente novamente. Se isto não fizer sentido, ' +
                            'contate a empresa.');
                    }
                }
                else {
                    precisaRegistrarPendenciaRelogioConfiavel = true;
                }
            }
            const sequencial = (ultimo?.sequencial ?? 0) + 1;
            const hashAnterior = ultimo?.hashAtual ?? motorista.hashGenesis;
            const latitude = this.arredondarCoordenada(dto.latitude);
            const longitude = this.arredondarCoordenada(dto.longitude);
            const fusoResolvido = (0, fuso_brasil_util_1.resolverFusoDoRegistro)(dto.fusoOffsetMin, dto.latitude, dto.longitude);
            const fusoOffsetMin = fusoResolvido.offsetMin;
            const hashAtual = this.hashChain.calcularHash(hashAnterior, sequencial, {
                motoristaId,
                fusoOffsetMin,
                tipoEvento: dto.tipoEvento,
                timestampEvento: dto.timestampEvento,
                latitude: latitude ?? null,
                longitude: longitude ?? null,
                precisaoGpsM: (0, precisao_gps_util_1.arredondarPrecisaoGps)(dto.precisaoGpsM),
                observacao: dto.observacao ?? null,
                sequencial,
                deviceUuidUsado,
            });
            const pfxDecifrado = this.crypto.decrypt(Buffer.from(motorista.certificadoPfxEnc), motorista.certificadoIv, motorista.certificadoAuthTag, motorista.id);
            const { privateKey } = this.certificados.decodificar(motorista.id, pfxDecifrado);
            const assinaturaDigital = this.assinaturas.assinar(privateKey, hashAtual);
            const registro = await tx.registroJornada.create({
                data: {
                    motoristaId,
                    tipoEvento: dto.tipoEvento,
                    timestampEvento: new Date(dto.timestampEvento),
                    latitude,
                    longitude,
                    precisaoGpsM: (0, precisao_gps_util_1.arredondarPrecisaoGps)(dto.precisaoGpsM),
                    observacao: dto.observacao,
                    sequencial,
                    hashAnterior,
                    hashAtual,
                    assinaturaDigital,
                    deviceUuidUsado,
                    idempotencyKey: dto.idempotencyKey,
                    elapsedRealtimeMs: dto.elapsedRealtimeMs ?? null,
                    fusoOffsetMin,
                },
            });
            if (precisaRegistrarPendenciaRelogioConfiavel &&
                dto.elapsedRealtimeMs != null) {
                await tx.verificacaoRelogioPendente.create({
                    data: {
                        registroJornadaId: registro.id,
                        motoristaId,
                        deviceUuidUsado,
                        elapsedRealtimeMs: dto.elapsedRealtimeMs,
                        timestampEvento: timestampEventoNovo,
                    },
                });
            }
            await this.audit.registrar({
                actorType: client_1.ActorType.MOTORISTA,
                actorId: motoristaId,
                acao: 'REGISTRO_JORNADA_CRIADO',
                entidade: 'RegistroJornada',
                entidadeId: registro.id,
                detalhes: { sequencial, tipoEvento: dto.tipoEvento, fusoOffsetMin },
                ip,
                userAgent,
            });
            if (fusoResolvido.divergenteDoGps) {
                await this.audit.registrar({
                    actorType: client_1.ActorType.MOTORISTA,
                    actorId: motoristaId,
                    acao: 'FUSO_APARELHO_INCOMPATIVEL_GPS',
                    entidade: 'RegistroJornada',
                    entidadeId: registro.id,
                    detalhes: {
                        fusoInformadoPeloAparelhoMin: fusoResolvido.informadoPeloAparelho,
                        fusoAplicadoMin: fusoOffsetMin,
                        latitude,
                        longitude,
                        deviceUuidUsado,
                    },
                    ip,
                    userAgent,
                });
            }
            if (dto.flagsIntegridadeDispositivo?.length) {
                await this.audit.registrar({
                    actorType: client_1.ActorType.MOTORISTA,
                    actorId: motoristaId,
                    acao: 'INTEGRIDADE_DISPOSITIVO_SUSPEITA',
                    entidade: 'RegistroJornada',
                    entidadeId: registro.id,
                    detalhes: {
                        flags: dto.flagsIntegridadeDispositivo,
                        deviceUuidUsado,
                    },
                    ip,
                    userAgent,
                });
            }
            const alertasGerados = await this.avaliarLimitesLegais(tx, motoristaId, registro);
            const alertasFraude = await this.avaliarAntifraude(tx, motoristaId, registro, horaRecebimentoServidor, dto.flagsIntegridadeDispositivo);
            const alertasFolga = await this.avaliarFolgaConflitante(tx, motoristaId, registro);
            await this.avaliarDescarregamento(tx, motoristaId, registro);
            alertaCteAbertoParaNotificar =
                await this.avaliarCteAbertoSemVinculoRecente(tx, motoristaId, registro);
            for (const alerta of [
                ...alertasGerados,
                ...alertasFraude,
                ...alertasFolga,
            ]) {
                if (alerta.severidade === 'CRITICO') {
                    alertasCriticosParaNotificar.push({
                        mensagem: alerta.mensagem,
                        tipo: alerta.tipo,
                    });
                }
            }
            return registro;
        }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
        for (const alerta of alertasCriticosParaNotificar) {
            void this.pushNotifications.notificarMotorista(motoristaId, 'Alerta de jornada', alerta.mensagem, { tipo: alerta.tipo });
            if (empresaIdParaNotificar) {
                void this.whatsapp.notificarGestoresDaEmpresa(empresaIdParaNotificar, alerta.mensagem);
            }
        }
        if (alertaCteAbertoParaNotificar && empresaIdParaNotificar) {
            void this.whatsapp.notificarGestoresDaEmpresa(empresaIdParaNotificar, alertaCteAbertoParaNotificar);
        }
        void this.agendarProximaVerificacaoSeAplicavel(motoristaId, registro.timestampEvento);
        return registro;
    }
    async processarLoteSequencial(motoristaId, deviceUuid, eventos, ip, userAgent) {
        const resultados = [];
        for (let index = 0; index < eventos.length; index++) {
            try {
                const registro = await this.create(motoristaId, deviceUuid, eventos[index], ip, userAgent);
                resultados.push({ index, sucesso: true, registroId: registro.id });
            }
            catch (err) {
                resultados.push({
                    index,
                    sucesso: false,
                    erro: err.message,
                });
            }
        }
        return resultados;
    }
    async processarLote(motoristaId, deviceUuid, eventos, ip, userAgent) {
        if (!this.filaLote) {
            return this.processarLoteSequencial(motoristaId, deviceUuid, eventos, ip, userAgent);
        }
        try {
            const job = await this.filaLote.add('processar', { motoristaId, deviceUuid, eventos, ip, userAgent }, { removeOnComplete: true, removeOnFail: 50, attempts: 1 });
            const resultado = (await job.waitUntilFinished(this.obterQueueEventsLote(), 30_000));
            return resultado;
        }
        catch (err) {
            this.logger.warn(`Falha ao processar lote via fila (motorista ${motoristaId}) , caindo no fallback síncrono: ${err.message}`);
            return this.processarLoteSequencial(motoristaId, deviceUuid, eventos, ip, userAgent);
        }
    }
    async avaliarLimitesLegais(tx, motoristaId, registroRecemCriado, agoraOverride) {
        try {
            const historico = await tx.registroJornada.findMany({
                where: { motoristaId },
                orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
            });
            const ultimoInicioJornada = [...historico]
                .filter((r) => r.tipoEvento === client_1.TipoEvento.INICIO_JORNADA)
                .pop();
            const tiposExistentes = new Set((await tx.alertaJornada.findMany({
                where: {
                    motoristaId,
                    createdAt: {
                        gte: ultimoInicioJornada?.timestampEvento ??
                            historico[0]?.timestampEvento ??
                            registroRecemCriado.timestampEvento,
                    },
                },
                select: { tipo: true },
            })).map((a) => a.tipo));
            const alertas = this.jornadaLegal.avaliar(historico, registroRecemCriado, tiposExistentes, agoraOverride);
            for (const alerta of alertas) {
                await tx.alertaJornada.create({
                    data: {
                        motoristaId,
                        tipo: alerta.tipo,
                        severidade: alerta.severidade,
                        mensagem: alerta.mensagem,
                        janelaInicio: alerta.janelaInicio,
                        janelaFim: alerta.janelaFim,
                        minutosAcumulados: alerta.minutosAcumulados,
                        registroGeradorId: registroRecemCriado.id,
                        detalhes: (alerta.detalhes ?? undefined),
                    },
                });
                await this.audit.registrar({
                    actorType: client_1.ActorType.SISTEMA,
                    acao: `ALERTA_JORNADA_${alerta.tipo}`,
                    entidade: 'AlertaJornada',
                    entidadeId: registroRecemCriado.id,
                    detalhes: {
                        severidade: alerta.severidade,
                        minutosAcumulados: alerta.minutosAcumulados,
                    },
                });
            }
            return alertas;
        }
        catch (err) {
            this.audit.registrar({
                actorType: client_1.ActorType.SISTEMA,
                acao: 'ALERTA_JORNADA_FALHA_AVALIACAO',
                entidade: 'RegistroJornada',
                entidadeId: registroRecemCriado.id,
                detalhes: { erro: err.message },
            });
            return [];
        }
    }
    async verificarJornadasAbertasProativamente() {
        return tenant_context_1.TenantContext.paraSistema(async () => {
            const jornadasAbertas = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT ultimo."motoristaId"
        FROM (
          SELECT DISTINCT ON (r."motoristaId") r."motoristaId", r."tipoEvento"
          FROM registros_jornada r
          WHERE r."tipoEvento" != 'OUTRO'
          ORDER BY r."motoristaId", r."timestampEvento" DESC, r.sequencial DESC
        ) ultimo
        WHERE ultimo."tipoEvento" != 'FIM_JORNADA'
      `);
            for (const { motoristaId } of jornadasAbertas) {
                await this.verificarEAgendarProximoMotorista(motoristaId);
            }
            return jornadasAbertas.length;
        });
    }
    async verificarEAgendarProximoMotorista(motoristaId) {
        await tenant_context_1.TenantContext.paraSistema(async () => {
            try {
                const motorista = await this.prisma.motorista.findUnique({
                    where: { id: motoristaId },
                });
                const ultimoRegistro = await this.prisma.registroJornada.findFirst({
                    where: { motoristaId },
                    orderBy: { sequencial: 'desc' },
                });
                if (!motorista || !ultimoRegistro)
                    return;
                const ajusteFimJornadaMaisRecente = await this.prisma.tratamentoPonto.findFirst({
                    where: { motoristaId, tipoEvento: client_1.TipoEvento.FIM_JORNADA },
                    orderBy: { createdAt: 'desc' },
                });
                if (ajusteFimJornadaMaisRecente) {
                    const inicioJornadaAtual = await this.prisma.registroJornada.findFirst({
                        where: { motoristaId, tipoEvento: client_1.TipoEvento.INICIO_JORNADA },
                        orderBy: { sequencial: 'desc' },
                    });
                    const ajusteEncerraJornadaAtual = ajusteFimJornadaMaisRecente.createdAt > ultimoRegistro.createdAt &&
                        (!inicioJornadaAtual ||
                            ajusteFimJornadaMaisRecente.timestampEvento >=
                                inicioJornadaAtual.timestampEvento);
                    if (ajusteEncerraJornadaAtual) {
                        await this.verificacaoAgendada?.cancelar(motoristaId);
                        return;
                    }
                }
                const agora = new Date();
                const alertas = await this.avaliarLimitesLegais(this.prisma, motoristaId, ultimoRegistro, agora);
                for (const alerta of alertas) {
                    if (alerta.severidade !== 'CRITICO' &&
                        alerta.severidade !== 'ATENCAO')
                        continue;
                    void this.pushNotifications.notificarMotorista(motoristaId, 'Alerta de jornada', alerta.mensagem, {
                        tipo: alerta.tipo,
                    });
                    void this.whatsapp.notificarGestoresDaEmpresa(motorista.empresaId, alerta.mensagem);
                }
                await this.agendarProximaVerificacaoSeAplicavel(motoristaId, agora);
            }
            catch (err) {
                this.audit.registrar({
                    actorType: client_1.ActorType.SISTEMA,
                    acao: 'VERIFICACAO_PROATIVA_JORNADA_FALHA',
                    entidade: 'Motorista',
                    entidadeId: motoristaId,
                    detalhes: { erro: err.message },
                });
            }
        });
    }
    async agendarProximaVerificacaoSeAplicavel(motoristaId, agora) {
        if (!this.verificacaoAgendada)
            return;
        try {
            const historico = await this.prisma.registroJornada.findMany({
                where: { motoristaId },
                orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
            });
            const proximo = this.jornadaLegal.calcularProximoLimiar(historico, agora);
            if (proximo) {
                await this.verificacaoAgendada.agendar(motoristaId, proximo.emMs);
            }
            else {
                await this.verificacaoAgendada.cancelar(motoristaId);
            }
        }
        catch (err) {
            this.logger.warn(`Falha ao agendar verificação futura do motorista ${motoristaId} (provável Redis indisponível): ${err.message}`);
            this.audit.registrar({
                actorType: client_1.ActorType.SISTEMA,
                acao: 'AGENDAMENTO_VERIFICACAO_JORNADA_FALHA',
                entidade: 'Motorista',
                entidadeId: motoristaId,
                detalhes: { erro: err.message },
            });
        }
    }
    async avaliarAntifraude(tx, motoristaId, registroRecemCriado, horaRecebimentoServidor, flagsIntegridadeDispositivo) {
        try {
            const historico = await tx.registroJornada.findMany({
                where: { motoristaId },
                orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
            });
            const tiposExistentes = new Set((await tx.alertaJornada.findMany({
                where: { motoristaId, registroGeradorId: registroRecemCriado.id },
                select: { tipo: true },
            })).map((a) => a.tipo));
            const alertas = this.antifraude.avaliar(historico, registroRecemCriado, horaRecebimentoServidor, flagsIntegridadeDispositivo, tiposExistentes);
            for (const alerta of alertas) {
                await tx.alertaJornada.create({
                    data: {
                        motoristaId,
                        tipo: alerta.tipo,
                        severidade: alerta.severidade,
                        mensagem: alerta.mensagem,
                        janelaInicio: alerta.janelaInicio,
                        janelaFim: alerta.janelaFim,
                        minutosAcumulados: alerta.minutosAcumulados,
                        registroGeradorId: registroRecemCriado.id,
                        detalhes: (alerta.detalhes ?? undefined),
                    },
                });
                await this.audit.registrar({
                    actorType: client_1.ActorType.SISTEMA,
                    acao: `ALERTA_ANTIFRAUDE_${alerta.tipo}`,
                    entidade: 'AlertaJornada',
                    entidadeId: registroRecemCriado.id,
                    detalhes: { severidade: alerta.severidade, ...alerta.detalhes },
                });
            }
            return alertas;
        }
        catch (err) {
            this.audit.registrar({
                actorType: client_1.ActorType.SISTEMA,
                acao: 'ALERTA_ANTIFRAUDE_FALHA_AVALIACAO',
                entidade: 'RegistroJornada',
                entidadeId: registroRecemCriado.id,
                detalhes: { erro: err.message },
            });
            return [];
        }
    }
    async avaliarFolgaConflitante(tx, motoristaId, registroRecemCriado) {
        try {
            const offsetDoPonto = registroRecemCriado.fusoOffsetMin ?? -180;
            const dia = new Date(`${(0, fuso_brasil_util_1.chaveDiaBrt)(registroRecemCriado.timestampEvento, offsetDoPonto)}T00:00:00.000Z`);
            const folgaDoDia = await tx.folgaConcedida.findUnique({
                where: { motoristaId_data: { motoristaId, data: dia } },
            });
            if (!folgaDoDia)
                return [];
            const diaFormatado = dia.toISOString().slice(0, 10);
            const mensagem = `Ponto batido em ${diaFormatado}, dia que já tinha folga concedida , confira o conflito.`;
            await tx.alertaJornada.create({
                data: {
                    motoristaId,
                    tipo: client_1.TipoAlertaJornada.PONTO_REGISTRADO_EM_DIA_DE_FOLGA,
                    severidade: client_1.SeveridadeAlerta.ATENCAO,
                    mensagem,
                    janelaInicio: new Date(dia.getTime() - offsetDoPonto * 60_000),
                    janelaFim: new Date(dia.getTime() - offsetDoPonto * 60_000 + 24 * 60 * 60 * 1000),
                    minutosAcumulados: 0,
                    registroGeradorId: registroRecemCriado.id,
                    detalhes: {
                        folgaConcedidaId: folgaDoDia.id,
                    },
                },
            });
            await this.audit.registrar({
                actorType: client_1.ActorType.SISTEMA,
                acao: 'ALERTA_JORNADA_PONTO_REGISTRADO_EM_DIA_DE_FOLGA',
                entidade: 'AlertaJornada',
                entidadeId: registroRecemCriado.id,
                detalhes: { motoristaId, folgaConcedidaId: folgaDoDia.id },
            });
            return [
                {
                    tipo: client_1.TipoAlertaJornada.PONTO_REGISTRADO_EM_DIA_DE_FOLGA,
                    severidade: client_1.SeveridadeAlerta.ATENCAO,
                    mensagem,
                },
            ];
        }
        catch (err) {
            this.audit.registrar({
                actorType: client_1.ActorType.SISTEMA,
                acao: 'ALERTA_JORNADA_FOLGA_FALHA_AVALIACAO',
                entidade: 'RegistroJornada',
                entidadeId: registroRecemCriado.id,
                detalhes: { erro: err.message },
            });
            return [];
        }
    }
    JANELA_CTE_RECENTE_MS = 120 * 60 * 1000;
    async avaliarCteAbertoSemVinculoRecente(tx, motoristaId, registroRecemCriado) {
        if (registroRecemCriado.tipoEvento !== 'INICIO_DIRECAO')
            return null;
        try {
            const desde = new Date(registroRecemCriado.timestampEvento.getTime() -
                this.JANELA_CTE_RECENTE_MS);
            const cteRecente = await tx.documentoCarga.findFirst({
                where: { motoristaId, tipo: 'CTE', createdAt: { gte: desde } },
                select: { id: true },
            });
            if (cteRecente)
                return null;
            const cteAberto = await tx.documentoCarga.findFirst({
                where: { motoristaId, tipo: 'CTE', statusCarga: 'CARREGADO' },
                orderBy: { createdAt: 'asc' },
                select: { id: true, numero: true, chaveAcesso: true, createdAt: true },
            });
            if (!cteAberto)
                return null;
            const jaAlertado = await tx.alertaJornada.findFirst({
                where: {
                    motoristaId,
                    tipo: client_1.TipoAlertaJornada.CTE_EM_ABERTO_SEM_VINCULO_RECENTE,
                    janelaInicio: cteAberto.createdAt,
                },
                select: { id: true },
            });
            if (jaAlertado)
                return null;
            const mensagem = `Motorista iniciou direção sem nenhum CT-e vinculado/emitido nas últimas ` +
                `${Math.round(this.JANELA_CTE_RECENTE_MS / 60000)} minutos, mas ainda existe um CT-e em aberto` +
                `${cteAberto.numero ? ` (nº ${cteAberto.numero})` : ''}, vinculado desde ${(0, fuso_brasil_util_1.marcarHorario)(cteAberto.createdAt)} ` +
                `e ainda sem "Fim de descarregamento" registrado. Confira se essa entrega já foi feita e só não foi baixada no ` +
                `sistema, ou se o motorista está rodando vazio por outro motivo.`;
            const alerta = await tx.alertaJornada.create({
                data: {
                    motoristaId,
                    tipo: client_1.TipoAlertaJornada.CTE_EM_ABERTO_SEM_VINCULO_RECENTE,
                    severidade: client_1.SeveridadeAlerta.ATENCAO,
                    mensagem,
                    janelaInicio: cteAberto.createdAt,
                    janelaFim: registroRecemCriado.timestampEvento,
                    minutosAcumulados: 0,
                    registroGeradorId: registroRecemCriado.id,
                    detalhes: {
                        documentoCargaId: cteAberto.id,
                        numero: cteAberto.numero,
                        chaveAcesso: cteAberto.chaveAcesso,
                    },
                },
            });
            await this.audit.registrar({
                actorType: client_1.ActorType.SISTEMA,
                acao: 'ALERTA_JORNADA_CTE_EM_ABERTO_SEM_VINCULO_RECENTE',
                entidade: 'AlertaJornada',
                entidadeId: alerta.id,
                detalhes: { motoristaId, documentoCargaId: cteAberto.id },
            });
            return mensagem;
        }
        catch (err) {
            await this.audit.registrar({
                actorType: client_1.ActorType.SISTEMA,
                acao: 'CTE_EM_ABERTO_SEM_VINCULO_RECENTE_FALHA_AVALIACAO',
                entidade: 'RegistroJornada',
                entidadeId: registroRecemCriado.id,
                detalhes: { erro: err.message },
            });
            return null;
        }
    }
    async avaliarDescarregamento(tx, motoristaId, registroRecemCriado) {
        if (registroRecemCriado.tipoEvento !== 'FIM_DESCARREGAMENTO')
            return;
        try {
            const documento = await tx.documentoCarga.findFirst({
                where: { motoristaId, tipo: 'CTE', statusCarga: 'CARREGADO' },
                orderBy: { createdAt: 'asc' },
            });
            if (!documento)
                return;
            await tx.documentoCarga.update({
                where: { id: documento.id },
                data: {
                    statusCarga: 'VAZIO',
                    entregueEm: registroRecemCriado.timestampEvento,
                },
            });
            await this.audit.registrar({
                actorType: client_1.ActorType.MOTORISTA,
                actorId: motoristaId,
                acao: 'DOCUMENTO_CARGA_ENTREGUE',
                entidade: 'DocumentoCarga',
                entidadeId: documento.id,
                detalhes: {
                    registroJornadaId: registroRecemCriado.id,
                    numero: documento.numero,
                    chaveAcesso: documento.chaveAcesso,
                },
            });
            await this.avaliarCercaVirtualEntrega(tx, motoristaId, registroRecemCriado, documento);
        }
        catch (err) {
            this.audit.registrar({
                actorType: client_1.ActorType.SISTEMA,
                acao: 'DOCUMENTO_CARGA_ENTREGA_FALHA_AVALIACAO',
                entidade: 'RegistroJornada',
                entidadeId: registroRecemCriado.id,
                detalhes: { erro: err.message },
            });
        }
    }
    async avaliarCercaVirtualEntrega(tx, motoristaId, registroRecemCriado, documento) {
        const RAIO_CERCA_VIRTUAL_M = 500;
        if (documento.destinatarioLatitude == null ||
            documento.destinatarioLongitude == null)
            return;
        if (registroRecemCriado.latitude == null ||
            registroRecemCriado.longitude == null)
            return;
        const distanciaM = this.distanciaHaversineMetros(Number(registroRecemCriado.latitude), Number(registroRecemCriado.longitude), Number(documento.destinatarioLatitude), Number(documento.destinatarioLongitude));
        if (distanciaM <= RAIO_CERCA_VIRTUAL_M)
            return;
        const mensagem = `"Fim de descarregamento" registrado a ${Math.round(distanciaM)}m do endereço do destinatário ` +
            `${documento.numero ? `(CT-e ${documento.numero})` : 'do CT-e'} , fora da cerca virtual de ${RAIO_CERCA_VIRTUAL_M}m. ` +
            `Confira se a entrega foi mesmo nesse endereço.`;
        await tx.alertaJornada.create({
            data: {
                motoristaId,
                tipo: client_1.TipoAlertaJornada.ENTREGA_FORA_DA_CERCA_VIRTUAL,
                severidade: client_1.SeveridadeAlerta.ATENCAO,
                mensagem,
                janelaInicio: registroRecemCriado.timestampEvento,
                janelaFim: registroRecemCriado.timestampEvento,
                minutosAcumulados: 0,
                registroGeradorId: registroRecemCriado.id,
                detalhes: {
                    documentoCargaId: documento.id,
                    numero: documento.numero,
                    chaveAcesso: documento.chaveAcesso,
                    distanciaMetros: Math.round(distanciaM),
                    raioCercaVirtualM: RAIO_CERCA_VIRTUAL_M,
                    fontePosicao: 'GPS_APARELHO',
                },
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.SISTEMA,
            acao: 'ALERTA_JORNADA_ENTREGA_FORA_DA_CERCA_VIRTUAL',
            entidade: 'AlertaJornada',
            entidadeId: registroRecemCriado.id,
            detalhes: {
                motoristaId,
                documentoCargaId: documento.id,
                distanciaMetros: Math.round(distanciaM),
            },
        });
    }
    distanciaHaversineMetros(lat1, lon1, lat2, lon2) {
        const RAIO_TERRA_M = 6371000;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        return RAIO_TERRA_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    async conferirTenant(motoristaId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
    }
    async consolidarViagens(motoristaId, grupoIdSolicitante) {
        await this.conferirTenant(motoristaId, grupoIdSolicitante);
        const registros = await this.prisma.registroJornada.findMany({
            where: { motoristaId },
            orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
        });
        if (registros.length === 0)
            return [];
        const gruposDiarios = [];
        let grupoAtual = [];
        for (const r of registros) {
            if (r.tipoEvento === 'INICIO_JORNADA' && grupoAtual.length > 0) {
                gruposDiarios.push(grupoAtual);
                grupoAtual = [];
            }
            grupoAtual.push(r);
        }
        if (grupoAtual.length > 0)
            gruposDiarios.push(grupoAtual);
        const jornadas = gruposDiarios.map((grupo) => this.resumirJornadaDiaria(grupo));
        const documentosCte = await this.prisma.documentoCarga.findMany({
            where: { motoristaId, tipo: 'CTE' },
            orderBy: { createdAt: 'asc' },
            select: { id: true, numero: true, createdAt: true, entregueEm: true },
        });
        const gruposCteBrutos = [];
        let coberturaFimMs = -Infinity;
        for (const doc of documentosCte) {
            const docFimMs = doc.entregueEm ? doc.entregueEm.getTime() : Infinity;
            if (gruposCteBrutos.length > 0 &&
                doc.createdAt.getTime() <= coberturaFimMs) {
                gruposCteBrutos[gruposCteBrutos.length - 1].push(doc);
            }
            else {
                gruposCteBrutos.push([doc]);
            }
            coberturaFimMs = Math.max(coberturaFimMs, docFimMs);
        }
        const gruposCte = gruposCteBrutos.map((docs) => {
            const algumAberto = docs.some((d) => d.entregueEm === null);
            const fim = algumAberto
                ? null
                : new Date(Math.max(...docs.map((d) => d.entregueEm.getTime())));
            return {
                inicio: docs[0].createdAt,
                fim,
                docs: docs.map((d) => ({ id: d.id, numero: d.numero })),
            };
        });
        const sobrepoe = (jornada, grupo) => {
            const fimGrupoMs = grupo.fim ? grupo.fim.getTime() : Infinity;
            return (jornada.inicio.getTime() <= fimGrupoMs &&
                jornada.fim.getTime() >= grupo.inicio.getTime());
        };
        const jornadaParaGrupo = new Map();
        for (const grupo of gruposCte) {
            for (const jornada of jornadas) {
                if (!jornadaParaGrupo.has(jornada) && sobrepoe(jornada, grupo)) {
                    jornadaParaGrupo.set(jornada, grupo);
                }
            }
        }
        const jornadasPorGrupo = new Map();
        for (const jornada of jornadas) {
            const grupo = jornadaParaGrupo.get(jornada);
            if (!grupo)
                continue;
            if (!jornadasPorGrupo.has(grupo))
                jornadasPorGrupo.set(grupo, []);
            jornadasPorGrupo.get(grupo).push(jornada);
        }
        const viagens = [];
        for (const [grupo, jornadasDoGrupo] of jornadasPorGrupo) {
            jornadasDoGrupo.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
            const primeira = jornadasDoGrupo[0];
            const ultima = jornadasDoGrupo[jornadasDoGrupo.length - 1];
            viagens.push({
                inicio: primeira.inicio,
                fim: ultima.fim,
                diasCorridos: 0,
                emAndamento: ultima.emAndamento || grupo.fim === null,
                jornadas: jornadasDoGrupo,
                totalDirecaoMin: jornadasDoGrupo.reduce((soma, j) => soma + j.totalDirecaoMin, 0),
                totalEsperaMin: jornadasDoGrupo.reduce((soma, j) => soma + j.totalEsperaMin, 0),
                totalJornadaMin: jornadasDoGrupo.reduce((soma, j) => soma + j.totalJornadaMin, 0),
                ctesRelacionados: grupo.docs,
            });
        }
        for (const jornada of jornadas) {
            if (jornadaParaGrupo.has(jornada))
                continue;
            viagens.push({
                inicio: jornada.inicio,
                fim: jornada.fim,
                diasCorridos: 0,
                emAndamento: jornada.emAndamento,
                jornadas: [jornada],
                totalDirecaoMin: jornada.totalDirecaoMin,
                totalEsperaMin: jornada.totalEsperaMin,
                totalJornadaMin: jornada.totalJornadaMin,
                ctesRelacionados: [],
            });
        }
        viagens.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
        for (const viagem of viagens) {
            const msPorDia = 24 * 60 * 60 * 1000;
            viagem.diasCorridos = Math.max(1, Math.ceil((viagem.fim.getTime() - viagem.inicio.getTime()) / msPorDia));
        }
        return viagens.reverse();
    }
    resumirJornadaDiaria(grupo) {
        const inicio = grupo[0].timestampEvento;
        const ultimoRegistro = grupo[grupo.length - 1];
        const emAndamento = ultimoRegistro.tipoEvento !== 'FIM_JORNADA';
        const fim = ultimoRegistro.timestampEvento;
        const direcaoMin = this.somarIntervalosSimples(grupo, 'INICIO_DIRECAO', ['FIM_DIRECAO'], fim);
        const esperaMin = this.somarIntervalosSimples(grupo, 'ESPERA_CARGA_DESCARGA', ['FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO'], fim);
        return {
            inicio,
            fim,
            emAndamento,
            totalDirecaoMin: Math.round(direcaoMin),
            totalEsperaMin: Math.round(esperaMin),
            totalJornadaMin: Math.round((fim.getTime() - inicio.getTime()) / 60000),
        };
    }
    somarIntervalosSimples(registros, tipoInicio, tiposFim, fimAbertoFallback) {
        const valoresFim = new Set(tiposFim);
        let totalMin = 0;
        let aberto = null;
        for (const r of registros) {
            if (r.tipoEvento === tipoInicio) {
                aberto = r.timestampEvento;
            }
            else if (valoresFim.has(r.tipoEvento) && aberto) {
                totalMin += (r.timestampEvento.getTime() - aberto.getTime()) / 60000;
                aberto = null;
            }
        }
        if (aberto)
            totalMin += (fimAbertoFallback.getTime() - aberto.getTime()) / 60000;
        return totalMin;
    }
    async listByMotorista(motoristaId, grupoIdSolicitante) {
        await this.conferirTenant(motoristaId, grupoIdSolicitante);
        return this.prisma.registroJornada.findMany({
            where: { motoristaId },
            orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
        });
    }
    async listarParaDispositivo(motoristaId, inicio, fim) {
        const desde = inicio ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const registros = await this.prisma.registroJornada.findMany({
            where: {
                motoristaId,
                timestampEvento: { gte: desde, ...(fim ? { lte: fim } : {}) },
            },
            orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
            take: 1000,
        });
        return registros.map((r) => ({
            idLocal: r.idempotencyKey ?? r.id,
            tipoEvento: r.tipoEvento,
            timestampEvento: r.timestampEvento.toISOString(),
            latitude: r.latitude != null ? Number(r.latitude) : null,
            longitude: r.longitude != null ? Number(r.longitude) : null,
            precisaoGpsM: r.precisaoGpsM ?? null,
            observacao: r.observacao ?? null,
            fusoOffsetMin: r.fusoOffsetMin ?? null,
            criadoEm: r.createdAt.toISOString(),
        }));
    }
    async buscarPorIdempotencyKey(motoristaId, idempotencyKey) {
        const registro = await this.prisma.registroJornada.findUnique({
            where: { idempotencyKey },
        });
        if (!registro || registro.motoristaId !== motoristaId) {
            throw new common_1.NotFoundException('Registro não encontrado');
        }
        return registro;
    }
    listByMotoristaNoPeriodo(motoristaId, inicio, fim, offsetEmpresaMin) {
        return this.prisma.registroJornada.findMany({
            where: {
                motoristaId,
                ...(inicio || fim
                    ? {
                        timestampEvento: {
                            ...(inicio
                                ? { gte: (0, fuso_brasil_util_1.inicioDePeriodoBrt)(inicio, offsetEmpresaMin) }
                                : {}),
                            ...(fim ? { lte: (0, fuso_brasil_util_1.fimDePeriodoBrt)(fim, offsetEmpresaMin) } : {}),
                        },
                    }
                    : {}),
            },
            orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
        });
    }
    explicarDivergencia(motivo, temGps) {
        if (motivo.includes('hashAtual')) {
            if (temGps) {
                return ('Causa mais provável: evento com localização GPS registrada. ' +
                    'Eventos desse tipo lançados há mais tempo podem ter ficado ' +
                    'marcados por uma limitação já corrigida no cálculo da ' +
                    'verificação de integridade para coordenadas de GPS , isso NÃO ' +
                    'significa, necessariamente, que o conteúdo do evento foi ' +
                    'alterado. Revise o evento (data, tipo e local) e, se o ' +
                    'conteúdo bater com o que foi realmente registrado, você pode ' +
                    'aceitar/regularizar esta divergência abaixo.');
            }
            return ('Este evento não tem localização GPS registrada, então foge do ' +
                'padrão mais comum de falso positivo. Antes de aceitar, confira ' +
                'com atenção se o conteúdo deste evento (data, hora, tipo) ' +
                'corresponde exatamente ao que foi de fato registrado.');
        }
        return ('A ordem da cadeia de eventos deste motorista está diferente do ' +
            'esperado neste ponto , confira se não há eventos fora de ordem ' +
            'ou algum registro ausente antes de aceitar/regularizar.');
    }
    async verificarIntegridade(motoristaId, actorId, grupoIdSolicitante) {
        await this.conferirTenant(motoristaId, grupoIdSolicitante);
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        const registros = await this.prisma.registroJornada.findMany({
            where: { motoristaId },
            orderBy: { sequencial: 'asc' },
        });
        const resultadoCadeia = this.hashChain.verificarCadeia(motorista.hashGenesis, registros);
        const pfxDecifrado = this.crypto.decrypt(Buffer.from(motorista.certificadoPfxEnc), motorista.certificadoIv, motorista.certificadoAuthTag, motorista.id);
        const { certificadoPem, fingerprint } = this.certificados.decodificar(motorista.id, pfxDecifrado);
        const fingerprintOk = fingerprint === motorista.certificadoFingerprint;
        const assinaturasInvalidas = [];
        for (const registro of registros) {
            if (!registro.assinaturaDigital) {
                assinaturasInvalidas.push(registro.sequencial);
                continue;
            }
            const ok = this.assinaturas.verificar(certificadoPem, registro.hashAtual, registro.assinaturaDigital);
            if (!ok)
                assinaturasInvalidas.push(registro.sequencial);
        }
        const aceites = await this.prisma.integridadeAceite.findMany({
            where: { motoristaId },
            include: { aceitoPorUsuario: { select: { nome: true } } },
        });
        const aceitePorSequencial = new Map(aceites.map((a) => [a.sequencial, a]));
        const divergencias = resultadoCadeia.quebras.map((quebra) => {
            const evento = registros.find((r) => r.sequencial === quebra.sequencial);
            const temGps = !!evento && evento.latitude !== null && evento.longitude !== null;
            const aceite = aceitePorSequencial.get(quebra.sequencial);
            return {
                sequencial: quebra.sequencial,
                motivoTecnico: quebra.motivo,
                explicacao: this.explicarDivergencia(quebra.motivo, temGps),
                tipoEvento: evento?.tipoEvento ?? null,
                timestampEvento: evento?.timestampEvento ?? null,
                criadoEm: evento?.createdAt ?? null,
                temGps,
                aceita: !!aceite,
                aceite: aceite
                    ? {
                        motivo: aceite.motivo,
                        aceitoPorNome: aceite.aceitoPorUsuario.nome,
                        aceitoEm: aceite.aceitoEm,
                    }
                    : null,
            };
        });
        const divergenciasPendentes = divergencias.filter((d) => !d.aceita);
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: actorId ?? null,
            acao: 'VERIFICACAO_INTEGRIDADE_CADEIA',
            entidade: 'Motorista',
            entidadeId: motoristaId,
            detalhes: {
                cadeiaValida: resultadoCadeia.valido,
                divergenciasPendentes: divergenciasPendentes.length,
            },
        });
        return {
            motoristaId,
            cadeiaValida: resultadoCadeia.valido,
            motivoCadeia: resultadoCadeia.motivo,
            primeiraQuebraSequencial: resultadoCadeia.primeiraQuebraSequencial,
            divergencias,
            totalRegistros: resultadoCadeia.totalRegistros,
            certificadoFingerprintOk: fingerprintOk,
            assinaturasInvalidas,
            integro: divergenciasPendentes.length === 0 &&
                fingerprintOk &&
                assinaturasInvalidas.length === 0,
        };
    }
    async varrerIntegridadeCadeias() {
        return tenant_context_1.TenantContext.paraSistema(async () => {
            const motoristas = await this.prisma.motorista.findMany({
                select: { id: true, nome: true, empresaId: true, hashGenesis: true },
            });
            let comViolacao = 0;
            let alertasCriados = 0;
            for (const motorista of motoristas) {
                try {
                    const registros = await this.prisma.registroJornada.findMany({
                        where: { motoristaId: motorista.id },
                        orderBy: { sequencial: 'asc' },
                    });
                    if (registros.length === 0)
                        continue;
                    const resultado = this.hashChain.verificarCadeia(motorista.hashGenesis, registros);
                    if (resultado.quebras.length === 0)
                        continue;
                    const aceites = await this.prisma.integridadeAceite.findMany({
                        where: { motoristaId: motorista.id },
                        select: { sequencial: true },
                    });
                    const aceitos = new Set(aceites.map((a) => a.sequencial));
                    const pendentes = resultado.quebras.filter((q) => !aceitos.has(q.sequencial));
                    if (pendentes.length === 0)
                        continue;
                    comViolacao++;
                    const assinatura = pendentes
                        .map((q) => q.sequencial)
                        .sort((a, b) => a - b)
                        .join(',');
                    const jaAlertados = await this.prisma.alertaJornada.findMany({
                        where: {
                            motoristaId: motorista.id,
                            tipo: 'INTEGRIDADE_CADEIA_VIOLADA',
                        },
                        select: { detalhes: true },
                    });
                    const jaExiste = jaAlertados.some((a) => a.detalhes?.assinatura ===
                        assinatura);
                    if (jaExiste)
                        continue;
                    const primeira = registros.find((r) => r.sequencial === pendentes[0].sequencial);
                    const mensagem = `Integridade violada: a cadeia de registros de ${motorista.nome} ` +
                        `tem ${pendentes.length} evento(s) cujo conteúdo não confere com o ` +
                        `hash gravado (nº ${assinatura}). Possível alteração direta no ` +
                        `banco de dados. Abra o motorista, analise cada evento e, se ` +
                        `for falso positivo conhecido, aceite a divergência.`;
                    await this.prisma.alertaJornada.create({
                        data: {
                            motoristaId: motorista.id,
                            tipo: 'INTEGRIDADE_CADEIA_VIOLADA',
                            severidade: 'CRITICO',
                            mensagem,
                            janelaInicio: primeira.timestampEvento,
                            janelaFim: primeira.timestampEvento,
                            minutosAcumulados: 0,
                            registroGeradorId: primeira.id,
                            detalhes: {
                                assinatura,
                                sequenciais: pendentes.map((q) => q.sequencial),
                                motivos: pendentes.map((q) => q.motivo),
                                origem: 'varredura_automatica',
                            },
                        },
                    });
                    alertasCriados++;
                    void this.whatsapp.notificarGestoresDaEmpresa(motorista.empresaId, mensagem);
                }
                catch (err) {
                    this.logger.warn(`Falha ao verificar a cadeia do motorista ${motorista.id}: ${err.message}`);
                }
            }
            return { verificados: motoristas.length, comViolacao, alertasCriados };
        });
    }
    async analisarEventoIntegridade(motoristaId, sequencial, grupoIdSolicitante) {
        await this.conferirTenant(motoristaId, grupoIdSolicitante);
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        const registros = await this.prisma.registroJornada.findMany({
            where: { motoristaId },
            orderBy: { sequencial: 'asc' },
        });
        const idx = registros.findIndex((r) => r.sequencial === sequencial);
        if (idx < 0)
            throw new common_1.NotFoundException('Evento não encontrado');
        const evento = registros[idx];
        const anterior = idx > 0 ? registros[idx - 1] : null;
        const proximo = idx < registros.length - 1 ? registros[idx + 1] : null;
        const hashEsperadoAnterior = anterior
            ? anterior.hashAtual
            : motorista.hashGenesis;
        const hashAnteriorConfere = evento.hashAnterior === hashEsperadoAnterior;
        const basePayload = {
            motoristaId: evento.motoristaId,
            tipoEvento: evento.tipoEvento,
            timestampEvento: evento.timestampEvento,
            latitude: evento.latitude,
            longitude: evento.longitude,
            precisaoGpsM: evento.precisaoGpsM,
            odometro: evento.odometro,
            observacao: evento.observacao,
            sequencial: evento.sequencial,
            deviceUuidUsado: evento.deviceUuidUsado,
            fusoOffsetMin: evento.fusoOffsetMin ?? null,
        };
        const hashDe = (payload, hashAnt) => this.hashChain.calcularHash(hashAnt, evento.sequencial, payload);
        const hashRecalculado = hashDe(basePayload, evento.hashAnterior);
        const hashConfere = hashRecalculado === evento.hashAtual;
        const variacoes = [
            {
                descricao: 'sem o fuso horário no cálculo',
                payload: { ...basePayload, fusoOffsetMin: null },
            },
            {
                descricao: 'sem a precisão do GPS',
                payload: { ...basePayload, precisaoGpsM: null },
            },
            {
                descricao: 'sem latitude/longitude',
                payload: { ...basePayload, latitude: null, longitude: null },
            },
            {
                descricao: 'sem observação',
                payload: { ...basePayload, observacao: null },
            },
            {
                descricao: 'sem odômetro',
                payload: { ...basePayload, odometro: null },
            },
            {
                descricao: 'precisão do GPS arredondada para inteiro',
                payload: {
                    ...basePayload,
                    precisaoGpsM: evento.precisaoGpsM == null
                        ? null
                        : Math.round(evento.precisaoGpsM),
                },
            },
        ];
        const tentativas = hashConfere
            ? []
            : variacoes.map((v) => ({
                descricao: v.descricao,
                bate: hashDe(v.payload, evento.hashAnterior) === evento.hashAtual,
            }));
        const variacaoQueBate = tentativas.find((t) => t.bate)?.descricao ?? null;
        const aceite = await this.prisma.integridadeAceite.findFirst({
            where: { motoristaId, sequencial },
            include: { aceitoPorUsuario: { select: { nome: true } } },
        });
        const divergente = !hashAnteriorConfere || !hashConfere;
        const temGps = evento.latitude !== null && evento.longitude !== null;
        const resumo = (r) => r
            ? {
                sequencial: r.sequencial,
                tipoEvento: r.tipoEvento,
                timestampEvento: r.timestampEvento,
                criadoEm: r.createdAt,
            }
            : null;
        return {
            motoristaId,
            divergente,
            explicacao: divergente
                ? this.explicarDivergencia(hashAnteriorConfere
                    ? 'hashAtual não corresponde ao recálculo (evento foi alterado)'
                    : 'hashAnterior não corresponde ao hash do evento anterior', temGps)
                : 'Este evento está íntegro: o hash gravado bate com o recálculo e o encadeamento com o evento anterior está correto.',
            evento: {
                sequencial: evento.sequencial,
                tipoEvento: evento.tipoEvento,
                timestampEvento: evento.timestampEvento,
                criadoEm: evento.createdAt,
                latitude: evento.latitude === null ? null : Number(evento.latitude),
                longitude: evento.longitude === null ? null : Number(evento.longitude),
                precisaoGpsM: evento.precisaoGpsM,
                odometro: evento.odometro,
                observacao: evento.observacao,
                fusoOffsetMin: evento.fusoOffsetMin ?? null,
                deviceUuidUsado: evento.deviceUuidUsado,
            },
            anterior: resumo(anterior),
            proximo: resumo(proximo),
            verificacao: {
                hashAnteriorConfere,
                hashAnteriorGravado: evento.hashAnterior,
                hashAnteriorEsperado: hashEsperadoAnterior,
                hashConfere,
                hashGravado: evento.hashAtual,
                hashRecalculado,
                payloadCanonico: this.hashChain.canonicalizar(basePayload),
                tentativas,
                variacaoQueBate,
            },
            aceite: aceite
                ? {
                    motivo: aceite.motivo,
                    aceitoPorNome: aceite.aceitoPorUsuario.nome,
                    aceitoEm: aceite.aceitoEm,
                }
                : null,
        };
    }
    async aceitarDivergenciaIntegridade(motoristaId, sequencial, motivo, usuarioId, grupoIdSolicitante) {
        await this.conferirTenant(motoristaId, grupoIdSolicitante);
        if (!motivo?.trim()) {
            throw new common_1.BadRequestException('Informe o motivo da regularização , fica registrado no histórico de quem aceitou e por quê.');
        }
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        const registros = await this.prisma.registroJornada.findMany({
            where: { motoristaId },
            orderBy: { sequencial: 'asc' },
        });
        const resultadoCadeia = this.hashChain.verificarCadeia(motorista.hashGenesis, registros);
        const divergente = resultadoCadeia.quebras.some((q) => q.sequencial === sequencial);
        if (!divergente) {
            throw new common_1.BadRequestException('Este evento não está com nenhuma divergência pendente na verificação de integridade.');
        }
        let aceite;
        try {
            aceite = await this.prisma.integridadeAceite.create({
                data: {
                    motoristaId,
                    sequencial,
                    motivo: motivo.trim(),
                    aceitoPorUsuarioId: usuarioId,
                },
                include: { aceitoPorUsuario: { select: { nome: true } } },
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                throw new common_1.ConflictException('Esta divergência já foi aceita/regularizada antes.');
            }
            throw err;
        }
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'INTEGRIDADE_DIVERGENCIA_ACEITA',
            entidade: 'Motorista',
            entidadeId: motoristaId,
            detalhes: { sequencial, motivo: motivo.trim() },
        });
        return aceite;
    }
    arredondarCoordenada(valor) {
        return (0, precisao_gps_util_1.arredondarCoordenadaGps)(valor);
    }
};
exports.RegistrosJornadaService = RegistrosJornadaService;
exports.RegistrosJornadaService = RegistrosJornadaService = RegistrosJornadaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(12, (0, bullmq_1.InjectQueue)(lote_registros_jornada_constants_1.FILA_LOTE_REGISTROS_JORNADA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        hash_chain_service_1.HashChainService,
        envelope_encryption_service_1.EnvelopeEncryptionService,
        certificate_service_1.CertificateService,
        signature_service_1.SignatureService,
        audit_service_1.AuditService,
        jornada_legal_service_1.JornadaLegalService,
        antifraude_service_1.AntifraudeService,
        push_notifications_service_1.PushNotificationsService,
        whatsapp_notifications_service_1.WhatsappNotificationsService,
        tenant_service_1.TenantService,
        verificacao_agendada_service_1.VerificacaoJornadaAgendadaService, Function])
], RegistrosJornadaService);
//# sourceMappingURL=registros-jornada.service.js.map