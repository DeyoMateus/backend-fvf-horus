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
var DocumentosCargaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentosCargaService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const bullmq_2 = require("bullmq");
const audit_service_1 = require("../common/audit/audit.service");
const geocoding_service_1 = require("../common/geocoding/geocoding.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const storage_service_1 = require("../common/storage/storage.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const extrair_metadados_xml_1 = require("./extrair-metadados-xml");
const documento_carga_storage_queue_1 = require("./storage-queue/documento-carga-storage.queue");
const pagination_util_1 = require("../common/pagination/pagination.util");
let DocumentosCargaService = DocumentosCargaService_1 = class DocumentosCargaService {
    prisma;
    audit;
    storage;
    geocoding;
    tenant;
    filaArmazenamento;
    logger = new common_1.Logger(DocumentosCargaService_1.name);
    constructor(prisma, audit, storage, geocoding, tenant, filaArmazenamento) {
        this.prisma = prisma;
        this.audit = audit;
        this.storage = storage;
        this.geocoding = geocoding;
        this.tenant = tenant;
        this.filaArmazenamento = filaArmazenamento;
    }
    async upload(grupoId, usuarioId, dto, arquivo) {
        let empresaId;
        if (dto.motoristaId) {
            const { empresaId: empresaIdDoMotorista } = await this.tenant.verificarMotoristaNoGrupo(dto.motoristaId, grupoId);
            await this.tenant.verificarMotoristaAtivo(dto.motoristaId);
            empresaId = empresaIdDoMotorista;
        }
        else if (dto.empresaId) {
            await this.tenant.verificarEmpresaNoGrupo(dto.empresaId, grupoId);
            empresaId = dto.empresaId;
        }
        else {
            throw new common_1.BadRequestException('Informe motoristaId ou empresaId (a que CNPJ do grupo este documento pertence)');
        }
        const xmlTexto = arquivo.buffer.toString('utf-8');
        const extraido = (0, extrair_metadados_xml_1.extrairMetadadosXml)(xmlTexto);
        const coordenadasDestinatario = await this.geocoding.geocodificar(extraido.enderecoDestinatario);
        const chaveR2 = `documentos-carga/${empresaId}/${(0, crypto_1.randomUUID)()}.xml`;
        let xmlOriginalParaSalvar = arquivo.buffer;
        let xmlStorageKeyParaSalvar = null;
        if (this.storage.configurado()) {
            try {
                await this.storage.subirObjeto(chaveR2, arquivo.buffer, 'application/xml');
                xmlOriginalParaSalvar = null;
                xmlStorageKeyParaSalvar = chaveR2;
            }
            catch (erro) {
                this.storage.logFalhaUpload(chaveR2, erro);
            }
        }
        const documento = await this.prisma.documentoCarga.create({
            data: {
                empresaId,
                motoristaId: dto.motoristaId,
                tipo: dto.tipo,
                statusCarga: dto.statusCarga,
                numero: dto.numero ?? extraido.numero,
                chaveAcesso: dto.chaveAcesso ?? extraido.chaveAcesso,
                enderecoDestinatario: extraido.enderecoDestinatario,
                destinatarioLatitude: coordenadasDestinatario?.latitude,
                destinatarioLongitude: coordenadasDestinatario?.longitude,
                geocodificadoEm: extraido.enderecoDestinatario ? new Date() : undefined,
                observacao: dto.observacao,
                xmlOriginal: xmlOriginalParaSalvar
                    ? new Uint8Array(xmlOriginalParaSalvar)
                    : null,
                xmlStorageKey: xmlStorageKeyParaSalvar,
                uploadedPorUsuarioId: usuarioId,
            },
            select: {
                id: true,
                tipo: true,
                numero: true,
                chaveAcesso: true,
                statusCarga: true,
                motoristaId: true,
                observacao: true,
                entregueEm: true,
                enderecoDestinatario: true,
                destinatarioLatitude: true,
                destinatarioLongitude: true,
                createdAt: true,
            },
        });
        if (this.storage.configurado() && !xmlStorageKeyParaSalvar) {
            await this.filaArmazenamento
                .add('retry-upload', {
                documentoId: documento.id,
                chave: chaveR2,
                conteudoBase64: arquivo.buffer.toString('base64'),
            }, { attempts: 5, backoff: { type: 'exponential', delay: 5000 } })
                .catch((erro) => this.logger.warn(`Não foi possível agendar retry de upload pro R2: ${erro.message}`));
        }
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'DOCUMENTO_CARGA_ENVIADO',
            entidade: 'DocumentoCarga',
            entidadeId: documento.id,
            detalhes: {
                tipo: dto.tipo,
                nomeArquivo: arquivo.originalname,
                numeroExtraidoAutomaticamente: !dto.numero && !!extraido.numero,
                chaveExtraidaAutomaticamente: !dto.chaveAcesso && !!extraido.chaveAcesso,
            },
        });
        return documento;
    }
    async listByGrupo(grupoId, page, pageSize, ordem, filtro) {
        const paginacao = (0, pagination_util_1.normalizarPaginacao)(page, pageSize);
        const where = {
            empresa: { grupoId },
            ...(filtro?.tipo ? { tipo: filtro.tipo } : {}),
            ...(filtro?.statusCarga ? { statusCarga: filtro.statusCarga } : {}),
            ...(filtro?.motoristaId ? { motoristaId: filtro.motoristaId } : {}),
            ...(filtro?.numero
                ? { numero: { contains: filtro.numero, mode: 'insensitive' } }
                : {}),
            ...(filtro?.chaveAcesso
                ? { chaveAcesso: { contains: filtro.chaveAcesso } }
                : {}),
        };
        const [dados, total] = await Promise.all([
            this.prisma.documentoCarga.findMany({
                where,
                select: {
                    id: true,
                    tipo: true,
                    numero: true,
                    chaveAcesso: true,
                    statusCarga: true,
                    motoristaId: true,
                    observacao: true,
                    entregueEm: true,
                    enderecoDestinatario: true,
                    destinatarioLatitude: true,
                    destinatarioLongitude: true,
                    createdAt: true,
                    motorista: { select: { nome: true } },
                },
                orderBy: { createdAt: ordem ?? 'desc' },
                skip: paginacao.skip,
                take: paginacao.take,
            }),
            this.prisma.documentoCarga.count({ where }),
        ]);
        return { dados, total, page: paginacao.page, pageSize: paginacao.pageSize };
    }
    async listByMotorista(motoristaId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        return this.prisma.documentoCarga.findMany({
            where: { motoristaId },
            select: {
                id: true,
                tipo: true,
                numero: true,
                chaveAcesso: true,
                statusCarga: true,
                observacao: true,
                entregueEm: true,
                enderecoDestinatario: true,
                destinatarioLatitude: true,
                destinatarioLongitude: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async statusAtualPorMotorista(motoristaId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        const [ultimo, cteEmAberto] = await Promise.all([
            this.prisma.documentoCarga.findFirst({
                where: { motoristaId },
                orderBy: { createdAt: 'desc' },
                select: {
                    statusCarga: true,
                    createdAt: true,
                    tipo: true,
                    numero: true,
                },
            }),
            this.prisma.documentoCarga.count({
                where: { motoristaId, tipo: 'CTE', statusCarga: 'CARREGADO' },
            }),
        ]);
        return { ...(ultimo ?? { statusCarga: null }), cteEmAberto };
    }
    async remover(documentoId, usuarioId, grupoIdSolicitante) {
        await this.tenant.verificarDocumentoCargaNoGrupo(documentoId, grupoIdSolicitante);
        const documento = await this.prisma.documentoCarga.findUnique({
            where: { id: documentoId },
        });
        if (!documento)
            throw new common_1.NotFoundException('Documento não encontrado');
        if (documento.motoristaId) {
            await this.tenant.verificarMotoristaAtivo(documento.motoristaId);
        }
        if (documento.xmlStorageKey) {
            await this.storage.excluirObjeto(documento.xmlStorageKey);
        }
        await this.prisma.documentoCarga.delete({ where: { id: documentoId } });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'DOCUMENTO_CARGA_EXCLUIDO',
            entidade: 'DocumentoCarga',
            entidadeId: documentoId,
            detalhes: {
                tipo: documento.tipo,
                numero: documento.numero,
                chaveAcesso: documento.chaveAcesso,
            },
        });
        return { ok: true };
    }
    async baixarXml(documentoId, grupoIdSolicitante) {
        await this.tenant.verificarDocumentoCargaNoGrupo(documentoId, grupoIdSolicitante);
        const documento = await this.prisma.documentoCarga.findUnique({
            where: { id: documentoId },
        });
        if (!documento)
            throw new common_1.NotFoundException('Documento não encontrado');
        if (documento.xmlStorageKey) {
            const conteudo = await this.storage.baixarObjeto(documento.xmlStorageKey);
            return { ...documento, xmlOriginal: conteudo };
        }
        if (!documento.xmlOriginal) {
            throw new common_1.NotFoundException('XML deste documento não foi encontrado nem no banco nem no storage externo');
        }
        return documento;
    }
};
exports.DocumentosCargaService = DocumentosCargaService;
exports.DocumentosCargaService = DocumentosCargaService = DocumentosCargaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, bullmq_1.InjectQueue)(documento_carga_storage_queue_1.FILA_ARMAZENAMENTO_DOCUMENTOS_CARGA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        storage_service_1.StorageService,
        geocoding_service_1.GeocodingService,
        tenant_service_1.TenantService,
        bullmq_2.Queue])
], DocumentosCargaService);
//# sourceMappingURL=documentos-carga.service.js.map