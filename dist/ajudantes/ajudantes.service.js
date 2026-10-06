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
exports.AjudantesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const audit_service_1 = require("../common/audit/audit.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const tenant_context_1 = require("../common/tenant/tenant-context");
const certificate_service_1 = require("../common/signature/certificate.service");
const envelope_encryption_service_1 = require("../common/crypto/envelope-encryption.service");
const hash_chain_service_1 = require("../common/hash-chain/hash-chain.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const pagination_util_1 = require("../common/pagination/pagination.util");
const device_key_hash_util_1 = require("../common/crypto/device-key-hash.util");
let AjudantesService = class AjudantesService {
    prisma;
    hashChain;
    certificados;
    crypto;
    audit;
    tenant;
    constructor(prisma, hashChain, certificados, crypto, audit, tenant) {
        this.prisma = prisma;
        this.hashChain = hashChain;
        this.certificados = certificados;
        this.crypto = crypto;
        this.audit = audit;
        this.tenant = tenant;
    }
    async create(dto, grupoId, actorId) {
        await this.tenant.verificarEmpresaNoGrupo(dto.empresaId, grupoId);
        const empresa = await this.prisma.empresa.findUnique({
            where: { id: dto.empresaId },
        });
        if (!empresa)
            throw new common_1.NotFoundException('Empresa não encontrada');
        const empresaId = dto.empresaId;
        const cpfExistente = await this.prisma.ajudante.findUnique({
            where: { cpf: dto.cpf },
        });
        if (cpfExistente)
            throw new common_1.ConflictException('CPF já cadastrado');
        const id = (0, crypto_1.randomUUID)();
        const hashGenesis = this.hashChain.gerarHashGenesis({
            empresaId,
            cpf: dto.cpf,
            cnh: id,
        });
        const certificado = this.certificados.gerarParaMotorista({
            id,
            nome: dto.nome,
            cpf: dto.cpf,
            empresaCnpj: empresa.cnpj,
        });
        const cifrado = this.crypto.encrypt(certificado.pfxBuffer, id);
        const ctxTenant = tenant_context_1.TenantContext.atual();
        if (!ctxTenant) {
            throw new Error('AjudantesService.create sem contexto de tenant , ver TenantContextInterceptor.');
        }
        const [, ajudante] = (await this.prisma.$transaction([
            this.prisma.$executeRawUnsafe(`SET LOCAL app.grupo_atual = '${ctxTenant.grupoId.replace(/'/g, "''")}'`),
            this.prisma.cru.ajudante.create({
                data: {
                    id,
                    nome: dto.nome,
                    cpf: dto.cpf,
                    telefone: dto.telefone ?? null,
                    status: client_1.StatusMotorista.ATIVO,
                    empresaId,
                    hashGenesis,
                    certificadoPfxEnc: cifrado.ciphertext,
                    certificadoIv: cifrado.iv,
                    certificadoAuthTag: cifrado.authTag,
                    certificadoFingerprint: certificado.fingerprint,
                    certificadoValidoAte: certificado.validoAte,
                },
                select: {
                    id: true,
                    nome: true,
                    cpf: true,
                    telefone: true,
                    status: true,
                    empresaId: true,
                    hashGenesis: true,
                    certificadoFingerprint: true,
                    certificadoValidoAte: true,
                    createdAt: true,
                },
            }),
        ]));
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: actorId ?? null,
            acao: 'AJUDANTE_CRIADO',
            entidade: 'Ajudante',
            entidadeId: ajudante.id,
            detalhes: { certificadoFingerprint: certificado.fingerprint },
        });
        return ajudante;
    }
    async atualizarStatus(id, dto, usuarioId, grupoIdSolicitante) {
        await this.tenant.verificarAjudanteNoGrupo(id, grupoIdSolicitante);
        const atual = await this.prisma.ajudante.findUnique({
            where: { id },
            select: { status: true },
        });
        if (!atual)
            throw new common_1.NotFoundException('Ajudante não encontrado');
        const ajudante = await this.prisma.ajudante.update({
            where: { id },
            data: { status: dto.status },
            select: {
                id: true,
                nome: true,
                cpf: true,
                status: true,
                empresaId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'AJUDANTE_STATUS_ALTERADO',
            entidade: 'Ajudante',
            entidadeId: id,
            detalhes: {
                statusAnterior: atual.status,
                statusNovo: dto.status,
                motivo: dto.motivo ?? null,
            },
        });
        return ajudante;
    }
    async findById(id, grupoIdSolicitante) {
        await this.tenant.verificarAjudanteNoGrupo(id, grupoIdSolicitante);
        const ajudante = await this.prisma.ajudante.findUnique({
            where: { id },
            select: {
                id: true,
                nome: true,
                cpf: true,
                telefone: true,
                status: true,
                empresaId: true,
                hashGenesis: true,
                certificadoFingerprint: true,
                certificadoValidoAte: true,
                createdAt: true,
                updatedAt: true,
                excluidoEm: true,
                motivoExclusao: true,
                dispositivoVinculado: {
                    select: { deviceUuid: true, vinculadoEm: true, atualizadoEm: true },
                },
            },
        });
        if (!ajudante)
            throw new common_1.NotFoundException('Ajudante não encontrado');
        return ajudante;
    }
    async listByGrupo(grupoId, page, pageSize, busca, incluirExcluidos) {
        const paginacao = (0, pagination_util_1.normalizarPaginacao)(page, pageSize);
        const termo = busca?.trim();
        const where = {
            empresa: { grupoId },
            ...(incluirExcluidos ? {} : { excluidoEm: null }),
            ...(termo
                ? {
                    OR: [
                        { nome: { contains: termo, mode: client_1.Prisma.QueryMode.insensitive } },
                        { cpf: { contains: termo } },
                    ],
                }
                : {}),
        };
        const [dados, total] = await Promise.all([
            this.prisma.ajudante.findMany({
                where,
                select: {
                    id: true,
                    nome: true,
                    cpf: true,
                    status: true,
                    certificadoValidoAte: true,
                    createdAt: true,
                    excluidoEm: true,
                    dispositivoVinculado: { select: { deviceUuid: true } },
                },
                orderBy: { nome: 'asc' },
                skip: paginacao.skip,
                take: paginacao.take,
            }),
            this.prisma.ajudante.count({ where }),
        ]);
        return { dados, total, page: paginacao.page, pageSize: paginacao.pageSize };
    }
    async excluir(id, motivo, usuarioId, grupoIdSolicitante) {
        await this.tenant.verificarAjudanteNoGrupo(id, grupoIdSolicitante);
        const atual = await this.prisma.ajudante.findUnique({
            where: { id },
            select: { status: true, excluidoEm: true },
        });
        if (!atual)
            throw new common_1.NotFoundException('Ajudante não encontrado');
        if (atual.excluidoEm)
            throw new common_1.ConflictException('Este cadastro já foi excluído');
        const agora = new Date();
        const ajudante = await this.prisma.$transaction(async (tx) => {
            await tx.dispositivoVinculadoAjudante.deleteMany({
                where: { ajudanteId: id },
            });
            return tx.ajudante.update({
                where: { id },
                data: {
                    status: client_1.StatusMotorista.INATIVO,
                    excluidoEm: agora,
                    excluidoPorUsuarioId: usuarioId,
                    motivoExclusao: motivo ?? null,
                },
                select: {
                    id: true,
                    nome: true,
                    cpf: true,
                    status: true,
                    excluidoEm: true,
                },
            });
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'AJUDANTE_EXCLUIDO',
            entidade: 'Ajudante',
            entidadeId: id,
            detalhes: { statusAnterior: atual.status, motivo: motivo ?? null },
        });
        return ajudante;
    }
    async vincularDispositivo(ajudanteId, dto, usuarioId, grupoIdSolicitante) {
        await this.tenant.verificarAjudanteNoGrupo(ajudanteId, grupoIdSolicitante);
        const deviceUuidEmUsoPorOutro = await this.prisma.dispositivoVinculadoAjudante.findFirst({
            where: { deviceUuid: dto.deviceUuid, ajudanteId: { not: ajudanteId } },
        });
        if (deviceUuidEmUsoPorOutro) {
            throw new common_1.ConflictException('Este aparelho já está vinculado a outro ajudante');
        }
        const deviceApiKeyPlano = (0, crypto_1.randomBytes)(32).toString('hex');
        const deviceApiKeyHash = (0, device_key_hash_util_1.hashChaveDispositivo)(deviceApiKeyPlano);
        const vinculo = await this.prisma.dispositivoVinculadoAjudante.upsert({
            where: { ajudanteId },
            update: {
                deviceUuid: dto.deviceUuid,
                deviceApiKeyHash,
                vinculadoPorUsuarioId: usuarioId,
            },
            create: {
                ajudanteId,
                deviceUuid: dto.deviceUuid,
                deviceApiKeyHash,
                vinculadoPorUsuarioId: usuarioId,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'DISPOSITIVO_AJUDANTE_VINCULADO',
            entidade: 'Ajudante',
            entidadeId: ajudanteId,
            detalhes: { deviceUuid: dto.deviceUuid },
        });
        return {
            ajudanteId,
            deviceUuid: vinculo.deviceUuid,
            vinculadoEm: vinculo.vinculadoEm,
            deviceApiKey: deviceApiKeyPlano,
        };
    }
    async statusDispositivo(ajudanteId, grupoIdSolicitante) {
        await this.tenant.verificarAjudanteNoGrupo(ajudanteId, grupoIdSolicitante);
        const vinculo = await this.prisma.dispositivoVinculadoAjudante.findUnique({
            where: { ajudanteId },
            select: {
                deviceUuid: true,
                vinculadoEm: true,
                atualizadoEm: true,
                vinculadoPorUsuarioId: true,
            },
        });
        return vinculo ?? { vinculado: false };
    }
    async revogarDispositivo(ajudanteId, usuarioId, grupoIdSolicitante) {
        await this.tenant.verificarAjudanteNoGrupo(ajudanteId, grupoIdSolicitante);
        const vinculo = await this.prisma.dispositivoVinculadoAjudante.findUnique({
            where: { ajudanteId },
        });
        if (!vinculo)
            throw new common_1.NotFoundException('Ajudante não tem dispositivo vinculado');
        await this.prisma.dispositivoVinculadoAjudante.delete({
            where: { ajudanteId },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'DISPOSITIVO_AJUDANTE_REVOGADO',
            entidade: 'Ajudante',
            entidadeId: ajudanteId,
            detalhes: { deviceUuidRevogado: vinculo.deviceUuid },
        });
    }
};
exports.AjudantesService = AjudantesService;
exports.AjudantesService = AjudantesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        hash_chain_service_1.HashChainService,
        certificate_service_1.CertificateService,
        envelope_encryption_service_1.EnvelopeEncryptionService,
        audit_service_1.AuditService,
        tenant_service_1.TenantService])
], AjudantesService);
//# sourceMappingURL=ajudantes.service.js.map