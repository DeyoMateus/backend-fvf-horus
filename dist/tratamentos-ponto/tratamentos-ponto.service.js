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
exports.TratamentosPontoService = void 0;
const common_1 = require("@nestjs/common");
const fuso_brasil_util_1 = require("../common/fuso/fuso-brasil.util");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const audit_service_1 = require("../common/audit/audit.service");
const hash_chain_service_1 = require("../common/hash-chain/hash-chain.service");
const push_notifications_service_1 = require("../common/notifications/push-notifications.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const storage_service_1 = require("../common/storage/storage.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const registros_jornada_service_1 = require("../registros-jornada/registros-jornada.service");
const validacao_sequencia_ajuste_1 = require("./validacao-sequencia-ajuste");
const TAMANHO_MAXIMO_EVIDENCIA_BYTES = 25 * 1024 * 1024;
const MAXIMO_EVIDENCIAS_POR_TRATAMENTO = 4;
let TratamentosPontoService = class TratamentosPontoService {
    prisma;
    hashChain;
    audit;
    tenant;
    storage;
    push;
    registrosJornada;
    constructor(prisma, hashChain, audit, tenant, storage, push, registrosJornada) {
        this.prisma = prisma;
        this.hashChain = hashChain;
        this.audit = audit;
        this.tenant = tenant;
        this.storage = storage;
        this.push = push;
        this.registrosJornada = registrosJornada;
    }
    async create(motoristaId, dto, usuarioId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        await this.tenant.verificarMotoristaAtivo(motoristaId);
        const tratamento = await this.criarRegistroAncorado(motoristaId, dto.tipoEvento, new Date(dto.timestampEvento), dto.motivo, usuarioId, dto.registroReferenciaId, dto.fusoOffsetMin);
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'TRATAMENTO_PONTO_CRIADO',
            entidade: 'TratamentoPonto',
            entidadeId: tratamento.id,
            detalhes: { motoristaId, tipoEvento: dto.tipoEvento, motivo: dto.motivo },
        });
        await this.push.notificarMotorista(motoristaId, 'Ajuste no seu ponto', `A empresa registrou um ajuste (${dto.tipoEvento}) referente a ${(0, fuso_brasil_util_1.marcarHorario)(new Date(dto.timestampEvento))}. Toque para ver o motivo e os comprovantes.`, { tipo: 'TRATAMENTO_PONTO', tratamentoId: tratamento.id });
        return tratamento;
    }
    async fusoDoMotoristaNoInstante(motoristaId, instante, informado) {
        if ((0, fuso_brasil_util_1.offsetValido)(informado))
            return informado;
        try {
            const antes = await this.prisma.registroJornada.findFirst({
                where: {
                    motoristaId,
                    timestampEvento: { lte: instante },
                    fusoOffsetMin: { not: null },
                },
                orderBy: { timestampEvento: 'desc' },
                select: { fusoOffsetMin: true },
            });
            if (antes?.fusoOffsetMin != null)
                return antes.fusoOffsetMin;
            const depois = await this.prisma.registroJornada.findFirst({
                where: {
                    motoristaId,
                    timestampEvento: { gt: instante },
                    fusoOffsetMin: { not: null },
                },
                orderBy: { timestampEvento: 'asc' },
                select: { fusoOffsetMin: true },
            });
            return depois?.fusoOffsetMin ?? null;
        }
        catch {
            return null;
        }
    }
    async validarEncaixeNaJornada(motoristaId, tipoEvento, timestampEvento) {
        const [regAnt, tratAnt, regPost, tratPost] = await Promise.all([
            this.prisma.registroJornada.findMany({
                where: { motoristaId, timestampEvento: { lte: timestampEvento } },
                orderBy: [{ timestampEvento: 'desc' }, { sequencial: 'desc' }],
                take: 100,
                select: { tipoEvento: true, timestampEvento: true },
            }),
            this.prisma.tratamentoPonto.findMany({
                where: { motoristaId, timestampEvento: { lte: timestampEvento } },
                orderBy: [{ timestampEvento: 'desc' }, { createdAt: 'desc' }],
                take: 100,
                select: { tipoEvento: true, timestampEvento: true },
            }),
            this.prisma.registroJornada.findMany({
                where: { motoristaId, timestampEvento: { gt: timestampEvento } },
                orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
                take: 20,
                select: { tipoEvento: true, timestampEvento: true },
            }),
            this.prisma.tratamentoPonto.findMany({
                where: { motoristaId, timestampEvento: { gt: timestampEvento } },
                orderBy: [{ timestampEvento: 'asc' }, { createdAt: 'asc' }],
                take: 20,
                select: { tipoEvento: true, timestampEvento: true },
            }),
        ]);
        const porHorario = (a, b) => a.timestampEvento.getTime() - b.timestampEvento.getTime();
        const anteriores = [...regAnt, ...tratAnt].sort(porHorario);
        const posteriores = [...regPost, ...tratPost].sort(porHorario);
        return (0, validacao_sequencia_ajuste_1.validarSequenciaAjuste)(tipoEvento, anteriores, posteriores);
    }
    async contextoDoAjuste(motoristaId, timestampEvento, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        const todos = [
            'INICIO_JORNADA',
            'INICIO_DESCANSO',
            'FIM_DESCANSO',
            'INICIO_DIRECAO',
            'FIM_DIRECAO',
            'ESPERA_CARGA_DESCARGA',
            'FIM_ESPERA_CARGA_DESCARGA',
            'FIM_DESCARREGAMENTO',
            'FIM_JORNADA',
            'OUTRO',
        ];
        const permitidos = [];
        for (const t of todos) {
            const r = await this.validarEncaixeNaJornada(motoristaId, t, timestampEvento);
            if (r.ok)
                permitidos.push(t);
        }
        return { permitidos };
    }
    async criarRegistroAncorado(motoristaId, tipoEvento, timestampEvento, motivo, usuarioId, registroReferenciaId, fusoOffsetMin) {
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        const usuario = await this.prisma.usuarioEmpresa.findUnique({
            where: { id: usuarioId },
        });
        if (!usuario)
            throw new common_1.NotFoundException('Usuário não encontrado');
        if (registroReferenciaId) {
            const referencia = await this.prisma.registroJornada.findUnique({
                where: { id: registroReferenciaId },
            });
            if (!referencia || referencia.motoristaId !== motoristaId) {
                throw new common_1.BadRequestException('registroReferenciaId não pertence a este motorista');
            }
        }
        const validacao = await this.validarEncaixeNaJornada(motoristaId, tipoEvento, timestampEvento);
        if (!validacao.ok)
            throw new common_1.BadRequestException(validacao.mensagem);
        const ultimoRegistro = await this.prisma.registroJornada.findFirst({
            where: { motoristaId },
            orderBy: { sequencial: 'desc' },
        });
        const hashReferencia = ultimoRegistro?.hashAtual ?? motorista.hashGenesis;
        const fusoDoAjuste = await this.fusoDoMotoristaNoInstante(motoristaId, timestampEvento, fusoOffsetMin);
        const canonico = JSON.stringify({
            motivo,
            motoristaId,
            registroReferenciaId: registroReferenciaId ?? null,
            timestampEvento: timestampEvento.toISOString(),
            tipoEvento,
            usuarioId,
        });
        const hashRegistro = this.hashChain.sha256(`${hashReferencia}|${canonico}`);
        const tratamento = await this.prisma.tratamentoPonto.create({
            data: {
                motoristaId,
                usuarioId,
                tipoEvento,
                timestampEvento,
                motivo,
                registroReferenciaId,
                fusoOffsetMin: fusoDoAjuste,
                hashReferencia,
                hashRegistro,
            },
        });
        void this.registrosJornada
            .verificarEAgendarProximoMotorista(motoristaId)
            .catch((err) => {
            this.audit.registrar({
                actorType: client_1.ActorType.SISTEMA,
                acao: 'REVERIFICACAO_JORNADA_APOS_AJUSTE_FALHA',
                entidade: 'TratamentoPonto',
                entidadeId: tratamento.id,
                detalhes: { erro: err.message },
            });
        });
        return tratamento;
    }
    async listByMotorista(motoristaId, grupoIdSolicitante) {
        if (grupoIdSolicitante) {
            await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        }
        return this.prisma.tratamentoPonto.findMany({
            where: { motoristaId },
            orderBy: { timestampEvento: 'asc' },
            include: {
                usuario: { select: { id: true, nome: true, email: true } },
                evidencias: {
                    select: {
                        id: true,
                        nomeArquivo: true,
                        contentType: true,
                        tamanhoBytes: true,
                        createdAt: true,
                    },
                },
            },
        });
    }
    async anexarEvidencia(tratamentoId, arquivo, usuarioId, grupoIdSolicitante) {
        if (arquivo.size > TAMANHO_MAXIMO_EVIDENCIA_BYTES) {
            throw new common_1.BadRequestException('Arquivo maior que o limite de 25MB');
        }
        const tratamento = await this.prisma.tratamentoPonto.findUnique({
            where: { id: tratamentoId },
        });
        if (!tratamento)
            throw new common_1.NotFoundException('Tratamento não encontrado');
        await this.tenant.verificarMotoristaNoGrupo(tratamento.motoristaId, grupoIdSolicitante);
        await this.tenant.verificarMotoristaAtivo(tratamento.motoristaId);
        const quantidadeAtual = await this.prisma.tratamentoPontoEvidencia.count({
            where: { tratamentoId },
        });
        if (quantidadeAtual >= MAXIMO_EVIDENCIAS_POR_TRATAMENTO) {
            throw new common_1.BadRequestException(`Este tratamento já tem o máximo de ${MAXIMO_EVIDENCIAS_POR_TRATAMENTO} evidências anexadas , remova uma antes de anexar outra.`);
        }
        if (!this.storage.configurado()) {
            throw new common_1.BadRequestException('Armazenamento de evidências (Cloudflare R2) não está configurado , peça para o administrador configurar as variáveis R2_* antes de anexar evidências.');
        }
        const chaveR2 = `tratamentos-ponto/${tratamentoId}/${(0, crypto_1.randomUUID)()}-${arquivo.originalname}`;
        try {
            await this.storage.subirObjeto(chaveR2, arquivo.buffer, arquivo.mimetype);
        }
        catch (erro) {
            this.storage.logFalhaUpload(chaveR2, erro);
            throw new common_1.BadRequestException('Falha ao enviar o arquivo para o armazenamento externo , tente novamente.');
        }
        const evidencia = await this.prisma.tratamentoPontoEvidencia.create({
            data: {
                tratamentoId,
                nomeArquivo: arquivo.originalname,
                contentType: arquivo.mimetype,
                tamanhoBytes: arquivo.size,
                chaveStorage: chaveR2,
                conteudo: null,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'TRATAMENTO_PONTO_EVIDENCIA_ANEXADA',
            entidade: 'TratamentoPontoEvidencia',
            entidadeId: evidencia.id,
            detalhes: {
                tratamentoId,
                nomeArquivo: arquivo.originalname,
                tamanhoBytes: arquivo.size,
            },
        });
        return {
            id: evidencia.id,
            nomeArquivo: evidencia.nomeArquivo,
            contentType: evidencia.contentType,
            tamanhoBytes: evidencia.tamanhoBytes,
        };
    }
    async removerEvidencia(evidenciaId, usuarioId, grupoIdSolicitante) {
        const evidencia = await this.verificarEvidenciaNoGrupo(evidenciaId, grupoIdSolicitante);
        const tratamentoPai = await this.prisma.tratamentoPonto.findUnique({
            where: { id: evidencia.tratamentoId },
            select: { motoristaId: true },
        });
        if (tratamentoPai) {
            await this.tenant.verificarMotoristaAtivo(tratamentoPai.motoristaId);
        }
        if (evidencia.chaveStorage) {
            await this.storage.excluirObjeto(evidencia.chaveStorage);
        }
        await this.prisma.tratamentoPontoEvidencia.delete({
            where: { id: evidenciaId },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'TRATAMENTO_PONTO_EVIDENCIA_REMOVIDA',
            entidade: 'TratamentoPontoEvidencia',
            entidadeId: evidenciaId,
            detalhes: {
                tratamentoId: evidencia.tratamentoId,
                nomeArquivo: evidencia.nomeArquivo,
            },
        });
    }
    async baixarEvidencia(evidenciaId) {
        const evidencia = await this.prisma.tratamentoPontoEvidencia.findUnique({
            where: { id: evidenciaId },
        });
        if (!evidencia)
            throw new common_1.NotFoundException('Evidência não encontrada');
        if (evidencia.chaveStorage) {
            const conteudo = await this.storage.baixarObjeto(evidencia.chaveStorage);
            return { ...evidencia, conteudo };
        }
        if (!evidencia.conteudo) {
            throw new common_1.NotFoundException('Arquivo desta evidência não foi encontrado nem no banco nem no storage externo');
        }
        return { ...evidencia, conteudo: Buffer.from(evidencia.conteudo) };
    }
    async verificarTratamentoNoGrupo(tratamentoId, grupoIdSolicitante) {
        const tratamento = await this.prisma.tratamentoPonto.findUnique({
            where: { id: tratamentoId },
        });
        if (!tratamento)
            throw new common_1.NotFoundException('Tratamento não encontrado');
        await this.tenant.verificarMotoristaNoGrupo(tratamento.motoristaId, grupoIdSolicitante);
        return tratamento;
    }
    async verificarEvidenciaNoGrupo(evidenciaId, grupoIdSolicitante) {
        const evidencia = await this.prisma.tratamentoPontoEvidencia.findUnique({
            where: { id: evidenciaId },
        });
        if (!evidencia)
            throw new common_1.NotFoundException('Evidência não encontrada');
        await this.verificarTratamentoNoGrupo(evidencia.tratamentoId, grupoIdSolicitante);
        return evidencia;
    }
    async listarMeusAjustes(motoristaId) {
        return this.prisma.tratamentoPonto.findMany({
            where: { motoristaId, solicitacaoOrigem: null },
            orderBy: { timestampEvento: 'desc' },
            include: {
                usuario: { select: { nome: true } },
                evidencias: {
                    select: {
                        id: true,
                        nomeArquivo: true,
                        contentType: true,
                        tamanhoBytes: true,
                    },
                },
            },
        });
    }
    async baixarEvidenciaDoMotorista(evidenciaId, motoristaId) {
        const evidencia = await this.prisma.tratamentoPontoEvidencia.findUnique({
            where: { id: evidenciaId },
        });
        if (!evidencia)
            throw new common_1.NotFoundException('Evidência não encontrada');
        const tratamento = await this.prisma.tratamentoPonto.findUnique({
            where: { id: evidencia.tratamentoId },
        });
        if (!tratamento || tratamento.motoristaId !== motoristaId) {
            throw new common_1.NotFoundException('Evidência não encontrada');
        }
        return this.baixarEvidencia(evidenciaId);
    }
    async darCiencia(tratamentoId, motoristaId) {
        const tratamento = await this.prisma.tratamentoPonto.findUnique({
            where: { id: tratamentoId },
        });
        if (!tratamento)
            throw new common_1.NotFoundException('Tratamento não encontrado');
        if (tratamento.motoristaId !== motoristaId) {
            throw new common_1.NotFoundException('Tratamento não encontrado');
        }
        if (tratamento.motoristaCienciaEm)
            return tratamento;
        return this.prisma.tratamentoPonto.update({
            where: { id: tratamentoId },
            data: { motoristaCienciaEm: new Date() },
        });
    }
};
exports.TratamentosPontoService = TratamentosPontoService;
exports.TratamentosPontoService = TratamentosPontoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        hash_chain_service_1.HashChainService,
        audit_service_1.AuditService,
        tenant_service_1.TenantService,
        storage_service_1.StorageService,
        push_notifications_service_1.PushNotificationsService,
        registros_jornada_service_1.RegistrosJornadaService])
], TratamentosPontoService);
//# sourceMappingURL=tratamentos-ponto.service.js.map