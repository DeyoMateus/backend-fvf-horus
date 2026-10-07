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
exports.DispositivosService = void 0;
const grupo_id_seguro_1 = require("../common/prisma/grupo-id-seguro");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const audit_service_1 = require("../common/audit/audit.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const tenant_context_1 = require("../common/tenant/tenant-context");
const device_key_hash_util_1 = require("../common/crypto/device-key-hash.util");
let DispositivosService = class DispositivosService {
    prisma;
    audit;
    tenant;
    constructor(prisma, audit, tenant) {
        this.prisma = prisma;
        this.audit = audit;
        this.tenant = tenant;
    }
    async vincular(motoristaId, dto, usuarioId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        await this.tenant.verificarMotoristaAtivo(motoristaId);
        const deviceUuidEmUsoPorOutro = await this.prisma.dispositivoVinculado.findFirst({
            where: {
                deviceUuid: dto.deviceUuid,
                motoristaId: { not: motoristaId },
            },
        });
        if (deviceUuidEmUsoPorOutro) {
            throw new common_1.ConflictException('Este aparelho já está vinculado a outro motorista');
        }
        const deviceApiKeyPlano = (0, crypto_1.randomBytes)(32).toString('hex');
        const deviceApiKeyHash = (0, device_key_hash_util_1.hashChaveDispositivo)(deviceApiKeyPlano);
        const vinculo = await this.prisma.dispositivoVinculado.upsert({
            where: { motoristaId },
            update: {
                deviceUuid: dto.deviceUuid,
                deviceApiKeyHash,
                vinculadoPorUsuarioId: usuarioId,
            },
            create: {
                motoristaId,
                deviceUuid: dto.deviceUuid,
                deviceApiKeyHash,
                vinculadoPorUsuarioId: usuarioId,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'DISPOSITIVO_VINCULADO',
            entidade: 'Motorista',
            entidadeId: motoristaId,
            detalhes: { deviceUuid: dto.deviceUuid },
        });
        return {
            motoristaId,
            deviceUuid: vinculo.deviceUuid,
            vinculadoEm: vinculo.vinculadoEm,
            deviceApiKey: deviceApiKeyPlano,
        };
    }
    async revogar(motoristaId, usuarioId, grupoIdSolicitante) {
        await this.conferirTenant(motoristaId, grupoIdSolicitante);
        const vinculo = await this.prisma.dispositivoVinculado.findUnique({
            where: { motoristaId },
        });
        if (!vinculo)
            throw new common_1.NotFoundException('Motorista não tem dispositivo vinculado');
        await this.prisma.dispositivoVinculado.delete({ where: { motoristaId } });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'DISPOSITIVO_REVOGADO',
            entidade: 'Motorista',
            entidadeId: motoristaId,
            detalhes: { deviceUuidRevogado: vinculo.deviceUuid },
        });
    }
    async status(motoristaId, grupoIdSolicitante) {
        await this.conferirTenant(motoristaId, grupoIdSolicitante);
        const vinculo = await this.prisma.dispositivoVinculado.findUnique({
            where: { motoristaId },
            select: {
                deviceUuid: true,
                vinculadoEm: true,
                atualizadoEm: true,
                vinculadoPorUsuarioId: true,
            },
        });
        return vinculo ?? { vinculado: false };
    }
    async conferirTenant(motoristaId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
    }
    async atualizarPushToken(motoristaId, pushToken) {
        await this.prisma.dispositivoVinculado.update({
            where: { motoristaId },
            data: { pushToken },
        });
    }
    async solicitarTroca(dto) {
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: dto.motoristaId },
        });
        const cpfOk = !!motorista &&
            motorista.cpf.length === dto.cpfConfirmacao.length &&
            (0, crypto_1.timingSafeEqual)(Buffer.from(motorista.cpf), Buffer.from(dto.cpfConfirmacao));
        if (!motorista || !cpfOk) {
            throw new common_1.NotFoundException('Motorista não encontrado ou CPF não corresponde');
        }
        const deviceUuidEmUsoPorOutro = await this.prisma.dispositivoVinculado.findFirst({
            where: {
                deviceUuid: dto.deviceUuidSolicitado,
                motoristaId: { not: dto.motoristaId },
            },
        });
        if (deviceUuidEmUsoPorOutro) {
            throw new common_1.ConflictException('Este aparelho já está vinculado a outro motorista');
        }
        const pendente = await this.prisma.solicitacaoTrocaDispositivo.findFirst({
            where: {
                motoristaId: dto.motoristaId,
                status: client_1.StatusSolicitacaoDispositivo.PENDENTE,
            },
        });
        const dados = {
            deviceUuidSolicitado: dto.deviceUuidSolicitado,
            modeloAparelho: dto.modeloAparelho ?? null,
            sistemaOperacional: dto.sistemaOperacional ?? null,
            observacaoMotorista: dto.observacaoMotorista ?? null,
        };
        const solicitacao = pendente
            ? await this.prisma.solicitacaoTrocaDispositivo.update({
                where: { id: pendente.id },
                data: dados,
            })
            : await this.prisma.solicitacaoTrocaDispositivo.create({
                data: { motoristaId: dto.motoristaId, ...dados },
            });
        await this.audit.registrar({
            actorType: client_1.ActorType.MOTORISTA,
            actorId: dto.motoristaId,
            acao: pendente
                ? 'SOLICITACAO_TROCA_DISPOSITIVO_ATUALIZADA'
                : 'SOLICITACAO_TROCA_DISPOSITIVO_CRIADA',
            entidade: 'SolicitacaoTrocaDispositivo',
            entidadeId: solicitacao.id,
            detalhes: { deviceUuidSolicitado: dto.deviceUuidSolicitado },
        });
        return solicitacao;
    }
    async listarSolicitacoesPendentes(grupoId) {
        return this.prisma.solicitacaoTrocaDispositivo.findMany({
            where: {
                status: client_1.StatusSolicitacaoDispositivo.PENDENTE,
                motorista: { empresa: { grupoId } },
            },
            include: { motorista: { select: { id: true, nome: true, cpf: true } } },
            orderBy: { criadoEm: 'asc' },
        });
    }
    async aprovarTroca(solicitacaoId, usuarioId, grupoId) {
        const solicitacao = await this.prisma.solicitacaoTrocaDispositivo.findUnique({
            where: { id: solicitacaoId },
            include: {
                motorista: { select: { empresa: { select: { grupoId: true } } } },
            },
        });
        if (!solicitacao)
            throw new common_1.NotFoundException('Solicitação não encontrada');
        if (solicitacao.motorista.empresa.grupoId !== grupoId) {
            throw new common_1.ForbiddenException('Solicitação não pertence ao seu grupo');
        }
        if (solicitacao.status !== client_1.StatusSolicitacaoDispositivo.PENDENTE) {
            throw new common_1.ConflictException('Esta solicitação já foi revisada');
        }
        await this.tenant.verificarMotoristaAtivo(solicitacao.motoristaId);
        const deviceUuidEmUsoPorOutro = await this.prisma.dispositivoVinculado.findFirst({
            where: {
                deviceUuid: solicitacao.deviceUuidSolicitado,
                motoristaId: { not: solicitacao.motoristaId },
            },
        });
        if (deviceUuidEmUsoPorOutro) {
            throw new common_1.ConflictException('Este aparelho já está vinculado a outro motorista , resolva manualmente antes de aprovar.');
        }
        const deviceApiKeyPlano = (0, crypto_1.randomBytes)(32).toString('hex');
        const deviceApiKeyHash = (0, device_key_hash_util_1.hashChaveDispositivo)(deviceApiKeyPlano);
        const ctxTenant = tenant_context_1.TenantContext.atual();
        if (!ctxTenant) {
            throw new Error('DispositivosService.aprovarTroca sem contexto de tenant , ver TenantContextInterceptor.');
        }
        const [, , dispositivoAtualizado] = await this.prisma.$transaction([
            this.prisma.$executeRawUnsafe(`SET LOCAL app.grupo_atual = '${(0, grupo_id_seguro_1.grupoIdSeguro)(ctxTenant.grupoId)}'`),
            this.prisma.cru.solicitacaoTrocaDispositivo.update({
                where: { id: solicitacaoId },
                data: {
                    status: client_1.StatusSolicitacaoDispositivo.APROVADA,
                    revisadoPorUsuarioId: usuarioId,
                    revisadoEm: new Date(),
                },
            }),
            this.prisma.cru.dispositivoVinculado.upsert({
                where: { motoristaId: solicitacao.motoristaId },
                update: {
                    deviceUuid: solicitacao.deviceUuidSolicitado,
                    deviceApiKeyHash,
                    vinculadoPorUsuarioId: usuarioId,
                    pushToken: null,
                },
                create: {
                    motoristaId: solicitacao.motoristaId,
                    deviceUuid: solicitacao.deviceUuidSolicitado,
                    deviceApiKeyHash,
                    vinculadoPorUsuarioId: usuarioId,
                },
            }),
        ]);
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'SOLICITACAO_TROCA_DISPOSITIVO_APROVADA',
            entidade: 'Motorista',
            entidadeId: solicitacao.motoristaId,
            detalhes: {
                solicitacaoId,
                deviceUuidNovo: solicitacao.deviceUuidSolicitado,
            },
        });
        return {
            motoristaId: solicitacao.motoristaId,
            deviceUuid: dispositivoAtualizado.deviceUuid,
            vinculadoEm: dispositivoAtualizado.vinculadoEm,
            deviceApiKey: deviceApiKeyPlano,
        };
    }
    async rejeitarTroca(solicitacaoId, usuarioId, motivo, grupoId) {
        const solicitacao = await this.prisma.solicitacaoTrocaDispositivo.findUnique({
            where: { id: solicitacaoId },
            include: {
                motorista: { select: { empresa: { select: { grupoId: true } } } },
            },
        });
        if (!solicitacao)
            throw new common_1.NotFoundException('Solicitação não encontrada');
        if (solicitacao.motorista.empresa.grupoId !== grupoId) {
            throw new common_1.ForbiddenException('Solicitação não pertence ao seu grupo');
        }
        if (solicitacao.status !== client_1.StatusSolicitacaoDispositivo.PENDENTE) {
            throw new common_1.ConflictException('Esta solicitação já foi revisada');
        }
        const atualizada = await this.prisma.solicitacaoTrocaDispositivo.update({
            where: { id: solicitacaoId },
            data: {
                status: client_1.StatusSolicitacaoDispositivo.REJEITADA,
                revisadoPorUsuarioId: usuarioId,
                revisadoEm: new Date(),
                motivoRejeicao: motivo,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'SOLICITACAO_TROCA_DISPOSITIVO_REJEITADA',
            entidade: 'Motorista',
            entidadeId: solicitacao.motoristaId,
            detalhes: { solicitacaoId, motivo },
        });
        return atualizada;
    }
};
exports.DispositivosService = DispositivosService;
exports.DispositivosService = DispositivosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        tenant_service_1.TenantService])
], DispositivosService);
//# sourceMappingURL=dispositivos.service.js.map