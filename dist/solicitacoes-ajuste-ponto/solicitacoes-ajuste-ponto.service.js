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
exports.SolicitacoesAjustePontoService = void 0;
const common_1 = require("@nestjs/common");
const fuso_brasil_util_1 = require("../common/fuso/fuso-brasil.util");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const audit_service_1 = require("../common/audit/audit.service");
const push_notifications_service_1 = require("../common/notifications/push-notifications.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const storage_service_1 = require("../common/storage/storage.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const tratamentos_ponto_service_1 = require("../tratamentos-ponto/tratamentos-ponto.service");
const pagination_util_1 = require("../common/pagination/pagination.util");
const TAMANHO_MAXIMO_EVIDENCIA_BYTES = 25 * 1024 * 1024;
const MAXIMO_EVIDENCIAS_POR_SOLICITACAO = 4;
const INCLUDE_PADRAO = {
    registroReferencia: {
        select: {
            id: true,
            sequencial: true,
            tipoEvento: true,
            timestampEvento: true,
        },
    },
    decididoPorUsuario: { select: { id: true, nome: true } },
    evidencias: {
        select: {
            id: true,
            nomeArquivo: true,
            contentType: true,
            tamanhoBytes: true,
            createdAt: true,
        },
    },
};
let SolicitacoesAjustePontoService = class SolicitacoesAjustePontoService {
    prisma;
    audit;
    tenant;
    storage;
    push;
    tratamentosPontoService;
    constructor(prisma, audit, tenant, storage, push, tratamentosPontoService) {
        this.prisma = prisma;
        this.audit = audit;
        this.tenant = tenant;
        this.storage = storage;
        this.push = push;
        this.tratamentosPontoService = tratamentosPontoService;
    }
    async criar(motoristaId, dto) {
        if (dto.registroReferenciaId) {
            const referencia = await this.prisma.registroJornada.findUnique({
                where: { id: dto.registroReferenciaId },
            });
            if (!referencia || referencia.motoristaId !== motoristaId) {
                throw new common_1.BadRequestException('registroReferenciaId não pertence a este motorista');
            }
        }
        const solicitacao = await this.prisma.solicitacaoAjustePonto.create({
            data: {
                motoristaId,
                tipoEvento: dto.tipoEvento,
                timestampEvento: new Date(dto.timestampEvento),
                justificativa: dto.justificativa,
                registroReferenciaId: dto.registroReferenciaId,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'SOLICITACAO_AJUSTE_PONTO_CRIADA',
            entidade: 'SolicitacaoAjustePonto',
            entidadeId: solicitacao.id,
            detalhes: {
                tipoEvento: dto.tipoEvento,
                timestampEvento: dto.timestampEvento,
            },
        });
        return solicitacao;
    }
    async listarMinhas(motoristaId) {
        return this.prisma.solicitacaoAjustePonto.findMany({
            where: { motoristaId },
            orderBy: { createdAt: 'desc' },
            include: INCLUDE_PADRAO,
        });
    }
    async anexarEvidenciaDoMotorista(solicitacaoId, motoristaId, arquivo) {
        const solicitacao = await this.prisma.solicitacaoAjustePonto.findUnique({
            where: { id: solicitacaoId },
        });
        if (!solicitacao || solicitacao.motoristaId !== motoristaId) {
            throw new common_1.NotFoundException('Solicitação não encontrada');
        }
        if (solicitacao.status !== client_1.StatusSolicitacaoAjuste.PENDENTE) {
            throw new common_1.BadRequestException('Esta solicitação já foi decidida, não é mais possível anexar evidências');
        }
        return this.anexarEvidencia(solicitacao.id, arquivo);
    }
    async removerEvidenciaDoMotorista(evidenciaId, motoristaId) {
        const evidencia = await this.prisma.solicitacaoAjustePontoEvidencia.findUnique({
            where: { id: evidenciaId },
        });
        if (!evidencia)
            throw new common_1.NotFoundException('Evidência não encontrada');
        const solicitacao = await this.prisma.solicitacaoAjustePonto.findUnique({
            where: { id: evidencia.solicitacaoId },
        });
        if (!solicitacao || solicitacao.motoristaId !== motoristaId) {
            throw new common_1.NotFoundException('Evidência não encontrada');
        }
        if (solicitacao.status !== client_1.StatusSolicitacaoAjuste.PENDENTE) {
            throw new common_1.BadRequestException('Esta solicitação já foi decidida, não é mais possível remover evidências');
        }
        await this.removerEvidencia(evidencia);
    }
    async baixarEvidenciaDoMotorista(evidenciaId, motoristaId) {
        const evidencia = await this.prisma.solicitacaoAjustePontoEvidencia.findUnique({
            where: { id: evidenciaId },
        });
        if (!evidencia)
            throw new common_1.NotFoundException('Evidência não encontrada');
        const solicitacao = await this.prisma.solicitacaoAjustePonto.findUnique({
            where: { id: evidencia.solicitacaoId },
        });
        if (!solicitacao || solicitacao.motoristaId !== motoristaId) {
            throw new common_1.NotFoundException('Evidência não encontrada');
        }
        return this.baixarEvidencia(evidenciaId);
    }
    async listarPorMotorista(motoristaId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        return this.prisma.solicitacaoAjustePonto.findMany({
            where: { motoristaId },
            orderBy: { createdAt: 'desc' },
            include: INCLUDE_PADRAO,
        });
    }
    async listarPendentesDoGrupo(grupoIdSolicitante) {
        return this.prisma.solicitacaoAjustePonto.findMany({
            where: {
                status: client_1.StatusSolicitacaoAjuste.PENDENTE,
                motorista: { empresa: { grupoId: grupoIdSolicitante } },
            },
            orderBy: { createdAt: 'asc' },
            include: {
                ...INCLUDE_PADRAO,
                motorista: { select: { id: true, nome: true } },
            },
        });
    }
    async listarHistoricoDoGrupo(grupoIdSolicitante, page, pageSize, ordem) {
        const paginacao = (0, pagination_util_1.normalizarPaginacao)(page, pageSize);
        const where = {
            status: {
                in: [
                    client_1.StatusSolicitacaoAjuste.APROVADA,
                    client_1.StatusSolicitacaoAjuste.REJEITADA,
                ],
            },
            motorista: { empresa: { grupoId: grupoIdSolicitante } },
        };
        const [dados, total] = await Promise.all([
            this.prisma.solicitacaoAjustePonto.findMany({
                where,
                orderBy: { decididoEm: ordem ?? 'desc' },
                skip: paginacao.skip,
                take: paginacao.take,
                include: {
                    ...INCLUDE_PADRAO,
                    motorista: { select: { id: true, nome: true } },
                },
            }),
            this.prisma.solicitacaoAjustePonto.count({ where }),
        ]);
        return { dados, total, page: paginacao.page, pageSize: paginacao.pageSize };
    }
    async aprovar(solicitacaoId, motivoDecisao, usuarioId, grupoIdSolicitante) {
        const solicitacao = await this.buscarPendentePertencente(solicitacaoId, grupoIdSolicitante);
        const tratamento = await this.tratamentosPontoService.criarRegistroAncorado(solicitacao.motoristaId, solicitacao.tipoEvento, solicitacao.timestampEvento, motivoDecisao?.trim()
            ? `Ajuste solicitado pelo motorista: ${solicitacao.justificativa} | Aprovado pelo RH: ${motivoDecisao}`
            : `Ajuste solicitado pelo motorista: ${solicitacao.justificativa}`, usuarioId, solicitacao.registroReferenciaId ?? undefined);
        const atualizada = await this.prisma.solicitacaoAjustePonto.update({
            where: { id: solicitacaoId },
            data: {
                status: client_1.StatusSolicitacaoAjuste.APROVADA,
                decididoPorUsuarioId: usuarioId,
                decididoEm: new Date(),
                motivoDecisao,
                tratamentoPontoId: tratamento.id,
            },
            include: INCLUDE_PADRAO,
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'SOLICITACAO_AJUSTE_PONTO_APROVADA',
            entidade: 'SolicitacaoAjustePonto',
            entidadeId: solicitacaoId,
            detalhes: {
                motoristaId: solicitacao.motoristaId,
                tratamentoPontoId: tratamento.id,
            },
        });
        await this.push.notificarMotorista(solicitacao.motoristaId, 'Pedido de ajuste aprovado', `Seu pedido de correção (${solicitacao.tipoEvento} em ${(0, fuso_brasil_util_1.marcarHorario)(solicitacao.timestampEvento)}) foi aprovado pela empresa.`, { tipo: 'SOLICITACAO_AJUSTE_APROVADA', solicitacaoId });
        return atualizada;
    }
    async rejeitar(solicitacaoId, motivoDecisao, usuarioId, grupoIdSolicitante) {
        if (!motivoDecisao?.trim()) {
            throw new common_1.BadRequestException('Informe o motivo da rejeição , o motorista precisa entender por quê');
        }
        const solicitacao = await this.buscarPendentePertencente(solicitacaoId, grupoIdSolicitante);
        const atualizada = await this.prisma.solicitacaoAjustePonto.update({
            where: { id: solicitacaoId },
            data: {
                status: client_1.StatusSolicitacaoAjuste.REJEITADA,
                decididoPorUsuarioId: usuarioId,
                decididoEm: new Date(),
                motivoDecisao,
            },
            include: INCLUDE_PADRAO,
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'SOLICITACAO_AJUSTE_PONTO_REJEITADA',
            entidade: 'SolicitacaoAjustePonto',
            entidadeId: solicitacaoId,
            detalhes: { motoristaId: solicitacao.motoristaId, motivoDecisao },
        });
        await this.push.notificarMotorista(solicitacao.motoristaId, 'Pedido de ajuste não aprovado', `Seu pedido de correção (${solicitacao.tipoEvento} em ${(0, fuso_brasil_util_1.marcarHorario)(solicitacao.timestampEvento)}) não foi aprovado. Motivo: ${motivoDecisao}`, { tipo: 'SOLICITACAO_AJUSTE_REJEITADA', solicitacaoId });
        return atualizada;
    }
    async baixarEvidenciaDoPainel(evidenciaId, grupoIdSolicitante) {
        const evidencia = await this.prisma.solicitacaoAjustePontoEvidencia.findUnique({
            where: { id: evidenciaId },
        });
        if (!evidencia)
            throw new common_1.NotFoundException('Evidência não encontrada');
        const solicitacao = await this.prisma.solicitacaoAjustePonto.findUnique({
            where: { id: evidencia.solicitacaoId },
        });
        if (!solicitacao)
            throw new common_1.NotFoundException('Evidência não encontrada');
        await this.tenant.verificarMotoristaNoGrupo(solicitacao.motoristaId, grupoIdSolicitante);
        return this.baixarEvidencia(evidenciaId);
    }
    async removerEvidenciaDoPainel(evidenciaId, grupoIdSolicitante) {
        const evidencia = await this.prisma.solicitacaoAjustePontoEvidencia.findUnique({
            where: { id: evidenciaId },
        });
        if (!evidencia)
            throw new common_1.NotFoundException('Evidência não encontrada');
        const solicitacao = await this.prisma.solicitacaoAjustePonto.findUnique({
            where: { id: evidencia.solicitacaoId },
        });
        if (!solicitacao)
            throw new common_1.NotFoundException('Evidência não encontrada');
        await this.tenant.verificarMotoristaNoGrupo(solicitacao.motoristaId, grupoIdSolicitante);
        await this.tenant.verificarMotoristaAtivo(solicitacao.motoristaId);
        await this.removerEvidencia(evidencia);
    }
    async buscarPendentePertencente(solicitacaoId, grupoIdSolicitante) {
        const solicitacao = await this.prisma.solicitacaoAjustePonto.findUnique({
            where: { id: solicitacaoId },
        });
        if (!solicitacao)
            throw new common_1.NotFoundException('Solicitação não encontrada');
        await this.tenant.verificarMotoristaNoGrupo(solicitacao.motoristaId, grupoIdSolicitante);
        if (solicitacao.status !== client_1.StatusSolicitacaoAjuste.PENDENTE) {
            throw new common_1.BadRequestException('Esta solicitação já foi decidida');
        }
        await this.tenant.verificarMotoristaAtivo(solicitacao.motoristaId);
        return solicitacao;
    }
    async anexarEvidencia(solicitacaoId, arquivo) {
        if (arquivo.size > TAMANHO_MAXIMO_EVIDENCIA_BYTES) {
            throw new common_1.BadRequestException('Arquivo maior que o limite de 25MB');
        }
        const quantidadeAtual = await this.prisma.solicitacaoAjustePontoEvidencia.count({
            where: { solicitacaoId },
        });
        if (quantidadeAtual >= MAXIMO_EVIDENCIAS_POR_SOLICITACAO) {
            throw new common_1.BadRequestException(`Esta solicitação já tem o máximo de ${MAXIMO_EVIDENCIAS_POR_SOLICITACAO} evidências anexadas , remova uma antes de anexar outra.`);
        }
        if (!this.storage.configurado()) {
            throw new common_1.BadRequestException('Armazenamento de evidências (Cloudflare R2) não está configurado , peça para o administrador configurar as variáveis R2_* antes de anexar evidências.');
        }
        const chaveR2 = `solicitacoes-ajuste-ponto/${solicitacaoId}/${(0, crypto_1.randomUUID)()}-${arquivo.originalname}`;
        try {
            await this.storage.subirObjeto(chaveR2, arquivo.buffer, arquivo.mimetype);
        }
        catch (erro) {
            this.storage.logFalhaUpload(chaveR2, erro);
            throw new common_1.BadRequestException('Falha ao enviar o arquivo para o armazenamento externo , tente novamente.');
        }
        return this.prisma.solicitacaoAjustePontoEvidencia.create({
            data: {
                solicitacaoId,
                nomeArquivo: arquivo.originalname,
                contentType: arquivo.mimetype,
                tamanhoBytes: arquivo.size,
                chaveStorage: chaveR2,
                conteudo: null,
            },
            select: {
                id: true,
                nomeArquivo: true,
                contentType: true,
                tamanhoBytes: true,
            },
        });
    }
    async removerEvidencia(evidencia) {
        if (evidencia.chaveStorage) {
            await this.storage.excluirObjeto(evidencia.chaveStorage);
        }
        await this.prisma.solicitacaoAjustePontoEvidencia.delete({
            where: { id: evidencia.id },
        });
    }
    async baixarEvidencia(evidenciaId) {
        const evidencia = await this.prisma.solicitacaoAjustePontoEvidencia.findUnique({
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
};
exports.SolicitacoesAjustePontoService = SolicitacoesAjustePontoService;
exports.SolicitacoesAjustePontoService = SolicitacoesAjustePontoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        tenant_service_1.TenantService,
        storage_service_1.StorageService,
        push_notifications_service_1.PushNotificationsService,
        tratamentos_ponto_service_1.TratamentosPontoService])
], SolicitacoesAjustePontoService);
//# sourceMappingURL=solicitacoes-ajuste-ponto.service.js.map