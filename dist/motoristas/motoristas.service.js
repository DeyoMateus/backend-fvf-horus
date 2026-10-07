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
exports.MotoristasService = void 0;
const grupo_id_seguro_1 = require("../common/prisma/grupo-id-seguro");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const normalizar_placa_util_1 = require("../veiculos/normalizar-placa.util");
const crypto_1 = require("crypto");
const audit_service_1 = require("../common/audit/audit.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const tenant_context_1 = require("../common/tenant/tenant-context");
const certificate_service_1 = require("../common/signature/certificate.service");
const envelope_encryption_service_1 = require("../common/crypto/envelope-encryption.service");
const hash_chain_service_1 = require("../common/hash-chain/hash-chain.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const pagination_util_1 = require("../common/pagination/pagination.util");
let MotoristasService = class MotoristasService {
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
        const [cpfExistente, cnhExistente] = await Promise.all([
            this.prisma.motorista.findUnique({ where: { cpf: dto.cpf } }),
            this.prisma.motorista.findUnique({ where: { cnh: dto.cnh } }),
        ]);
        if (cpfExistente || cnhExistente)
            throw new common_1.ConflictException('CPF ou CNH já cadastrado');
        const id = (0, crypto_1.randomUUID)();
        const hashGenesis = this.hashChain.gerarHashGenesis({
            empresaId,
            cpf: dto.cpf,
            cnh: dto.cnh,
        });
        const certificado = this.certificados.gerarParaMotorista({
            id,
            nome: dto.nome,
            cpf: dto.cpf,
            empresaCnpj: empresa.cnpj,
        });
        const cifrado = this.crypto.encrypt(certificado.pfxBuffer, id);
        const placaNormalizada = dto.placa ? (0, normalizar_placa_util_1.normalizarPlaca)(dto.placa) : null;
        const ctxTenant = tenant_context_1.TenantContext.atual();
        if (!ctxTenant) {
            throw new Error('MotoristasService.create sem contexto de tenant , ver TenantContextInterceptor.');
        }
        const operacoes = [
            this.prisma.$executeRawUnsafe(`SET LOCAL app.grupo_atual = '${(0, grupo_id_seguro_1.grupoIdSeguro)(ctxTenant.grupoId)}'`),
            this.prisma.cru.motorista.create({
                data: {
                    id,
                    nome: dto.nome,
                    cpf: dto.cpf,
                    cnh: dto.cnh,
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
                    cnh: true,
                    telefone: true,
                    status: true,
                    empresaId: true,
                    hashGenesis: true,
                    certificadoFingerprint: true,
                    certificadoValidoAte: true,
                    createdAt: true,
                },
            }),
        ];
        if (placaNormalizada) {
            operacoes.push(this.prisma.cru.veiculoVinculado.create({
                data: {
                    motoristaId: id,
                    placa: placaNormalizada,
                    idRastreador: dto.idRastreador,
                    tecnologiaRastreador: dto.tecnologiaRastreador,
                    atualizadoPorTipo: client_1.ActorType.USUARIO_EMPRESA,
                    atualizadoPorId: actorId ?? null,
                },
            }));
        }
        const [, motorista] = (await this.prisma.$transaction(operacoes));
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: actorId ?? null,
            acao: 'MOTORISTA_CRIADO',
            entidade: 'Motorista',
            entidadeId: motorista.id,
            detalhes: {
                certificadoFingerprint: certificado.fingerprint,
                placa: placaNormalizada,
            },
        });
        return motorista;
    }
    async atualizarStatus(id, dto, usuarioId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(id, grupoIdSolicitante);
        const atual = await this.prisma.motorista.findUnique({
            where: { id },
            select: { status: true, excluidoEm: true },
        });
        if (!atual)
            throw new common_1.NotFoundException('Motorista não encontrado');
        if (atual.excluidoEm) {
            throw new common_1.ForbiddenException('Este cadastro está excluído e não pode ser alterado , o histórico continua disponível pra consulta.');
        }
        const motorista = await this.prisma.motorista.update({
            where: { id },
            data: { status: dto.status },
            select: {
                id: true,
                nome: true,
                cpf: true,
                cnh: true,
                status: true,
                empresaId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'MOTORISTA_STATUS_ALTERADO',
            entidade: 'Motorista',
            entidadeId: id,
            detalhes: {
                statusAnterior: atual.status,
                statusNovo: dto.status,
                motivo: dto.motivo ?? null,
            },
        });
        return motorista;
    }
    async atualizarCadastro(id, dto, usuarioId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(id, grupoIdSolicitante);
        await this.tenant.verificarMotoristaAtivo(id);
        const atual = await this.prisma.motorista.findUnique({
            where: { id },
            select: { nome: true, telefone: true },
        });
        if (!atual)
            throw new common_1.NotFoundException('Motorista não encontrado');
        const data = {};
        if (dto.nome !== undefined)
            data.nome = dto.nome;
        if (dto.telefone !== undefined)
            data.telefone = dto.telefone;
        const motorista = await this.prisma.motorista.update({
            where: { id },
            data,
            select: {
                id: true,
                nome: true,
                cpf: true,
                cnh: true,
                telefone: true,
                status: true,
                empresaId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'MOTORISTA_CADASTRO_ATUALIZADO',
            entidade: 'Motorista',
            entidadeId: id,
            detalhes: {
                nomeAnterior: atual.nome,
                nomeNovo: motorista.nome,
                telefoneAnterior: atual.telefone,
                telefoneNovo: motorista.telefone,
            },
        });
        return motorista;
    }
    async findById(id, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(id, grupoIdSolicitante);
        const motorista = await this.prisma.motorista.findUnique({
            where: { id },
            select: {
                id: true,
                nome: true,
                cpf: true,
                cnh: true,
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
                veiculoVinculado: {
                    select: {
                        placa: true,
                        idRastreador: true,
                        tecnologiaRastreador: true,
                        atualizadoEm: true,
                    },
                },
            },
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        return motorista;
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
            this.prisma.motorista.findMany({
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
                    veiculoVinculado: { select: { placa: true } },
                },
                orderBy: { nome: 'asc' },
                skip: paginacao.skip,
                take: paginacao.take,
            }),
            this.prisma.motorista.count({ where }),
        ]);
        return { dados, total, page: paginacao.page, pageSize: paginacao.pageSize };
    }
    async excluir(id, motivo, usuarioId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(id, grupoIdSolicitante);
        const atual = await this.prisma.motorista.findUnique({
            where: { id },
            select: { status: true, excluidoEm: true, nome: true },
        });
        if (!atual)
            throw new common_1.NotFoundException('Motorista não encontrado');
        if (atual.excluidoEm)
            throw new common_1.ConflictException('Este cadastro já foi excluído');
        const agora = new Date();
        const motorista = await this.prisma.$transaction(async (tx) => {
            await tx.dispositivoVinculado.deleteMany({ where: { motoristaId: id } });
            return tx.motorista.update({
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
                    cnh: true,
                    status: true,
                    excluidoEm: true,
                },
            });
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'MOTORISTA_EXCLUIDO',
            entidade: 'Motorista',
            entidadeId: id,
            detalhes: { statusAnterior: atual.status, motivo: motivo ?? null },
        });
        return motorista;
    }
    async obterPerfilProprio(motoristaId) {
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            select: { id: true, nome: true, cpf: true, telefone: true },
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        return motorista;
    }
    async atualizarPerfilProprio(motoristaId, dto) {
        const atualizado = await this.prisma.motorista.update({
            where: { id: motoristaId },
            data: { nome: dto.nome, telefone: dto.telefone },
            select: { id: true, nome: true, cpf: true, telefone: true },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'MOTORISTA_ATUALIZOU_PROPRIO_PERFIL',
            entidade: 'Motorista',
            entidadeId: motoristaId,
        });
        return atualizado;
    }
    async listarAlertasIntegridadeDispositivo(motoristaId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        return this.prisma.auditLog.findMany({
            where: { acao: 'INTEGRIDADE_DISPOSITIVO_SUSPEITA', actorId: motoristaId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
    }
};
exports.MotoristasService = MotoristasService;
exports.MotoristasService = MotoristasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        hash_chain_service_1.HashChainService,
        certificate_service_1.CertificateService,
        envelope_encryption_service_1.EnvelopeEncryptionService,
        audit_service_1.AuditService,
        tenant_service_1.TenantService])
], MotoristasService);
//# sourceMappingURL=motoristas.service.js.map