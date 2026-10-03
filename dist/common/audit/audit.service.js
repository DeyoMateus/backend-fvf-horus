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
var AuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const tenant_context_1 = require("../tenant/tenant-context");
const pagination_util_1 = require("../pagination/pagination.util");
let AuditService = AuditService_1 = class AuditService {
    prisma;
    logger = new common_1.Logger(AuditService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async registrar(input) {
        try {
            const grupoId = this.resolverGrupoId(input.grupoId);
            await this.prisma.auditLog.create({
                data: {
                    actorType: input.actorType,
                    actorId: input.actorId ?? null,
                    acao: input.acao,
                    entidade: input.entidade,
                    entidadeId: input.entidadeId ?? null,
                    detalhes: (input.detalhes ?? undefined),
                    ip: input.ip ?? null,
                    userAgent: input.userAgent ?? null,
                    grupoId,
                },
            });
        }
        catch (err) {
            this.logger.error(`Falha ao gravar audit log (${input.acao}/${input.entidade})`, err);
        }
    }
    resolverGrupoId(explicito) {
        if (explicito !== undefined)
            return explicito;
        const ctx = tenant_context_1.TenantContext.atual();
        if (!ctx || ctx.grupoId === tenant_context_1.SISTEMA)
            return null;
        return ctx.grupoId;
    }
    async listar(filtro, grupoId) {
        const paginacao = (0, pagination_util_1.normalizarPaginacao)(filtro.page, filtro.pageSize);
        const actorTypeWhere = filtro.actorType
            ? filtro.actorType
            : filtro.excluirActorTypes && filtro.excluirActorTypes.length > 0
                ? { notIn: filtro.excluirActorTypes }
                : undefined;
        const where = {
            ...(grupoId !== null ? { grupoId } : {}),
            ...(actorTypeWhere !== undefined ? { actorType: actorTypeWhere } : {}),
            ...(filtro.acoes && filtro.acoes.length > 0
                ? { acao: { in: filtro.acoes } }
                : {}),
            ...(filtro.entidade ? { entidade: filtro.entidade } : {}),
            ...(filtro.entidadeId ? { entidadeId: filtro.entidadeId } : {}),
            ...(filtro.dataInicio || filtro.dataFim
                ? {
                    createdAt: {
                        ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}),
                        ...(filtro.dataFim ? { lte: filtro.dataFim } : {}),
                    },
                }
                : {}),
        };
        const [dados, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: filtro.ordem ?? 'desc' },
                skip: paginacao.skip,
                take: paginacao.take,
            }),
            this.prisma.auditLog.count({ where }),
        ]);
        const dadosComNome = await this.resolverNomesDosAtores(dados);
        return {
            dados: dadosComNome,
            total,
            page: paginacao.page,
            pageSize: paginacao.pageSize,
        };
    }
    async resolverNomesDosAtores(dados) {
        const idsUsuarioEmpresa = [
            ...new Set(dados
                .filter((d) => d.actorType === client_1.ActorType.USUARIO_EMPRESA && d.actorId)
                .map((d) => d.actorId)),
        ];
        const idsMotorista = [
            ...new Set(dados
                .filter((d) => d.actorType === client_1.ActorType.MOTORISTA && d.actorId)
                .map((d) => d.actorId)),
        ];
        const idsSuperAdmin = [
            ...new Set(dados
                .filter((d) => d.actorType === client_1.ActorType.SUPER_ADMIN && d.actorId)
                .map((d) => d.actorId)),
        ];
        const [usuarios, motoristas, superAdmins] = await Promise.all([
            idsUsuarioEmpresa.length > 0
                ? this.prisma.usuarioEmpresa.findMany({
                    where: { id: { in: idsUsuarioEmpresa } },
                    select: { id: true, nome: true },
                })
                : [],
            idsMotorista.length > 0
                ? this.prisma.motorista.findMany({
                    where: { id: { in: idsMotorista } },
                    select: { id: true, nome: true },
                })
                : [],
            idsSuperAdmin.length > 0
                ? this.prisma.superAdminUsuario.findMany({
                    where: { id: { in: idsSuperAdmin } },
                    select: { id: true, nome: true },
                })
                : [],
        ]);
        const mapaNomes = new Map();
        for (const u of usuarios)
            mapaNomes.set(u.id, u.nome);
        for (const m of motoristas)
            mapaNomes.set(m.id, m.nome);
        for (const s of superAdmins)
            mapaNomes.set(s.id, s.nome);
        return dados.map((d) => ({
            ...d,
            actorNome: d.actorId ? (mapaNomes.get(d.actorId) ?? null) : null,
        }));
    }
    async listarTiposOcorridos(grupoId) {
        const registros = await this.prisma.auditLog.findMany({
            where: grupoId !== null ? { grupoId } : {},
            select: { acao: true, entidade: true },
            distinct: ['acao', 'entidade'],
            orderBy: [{ entidade: 'asc' }, { acao: 'asc' }],
            take: 500,
        });
        return registros;
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditService);
//# sourceMappingURL=audit.service.js.map