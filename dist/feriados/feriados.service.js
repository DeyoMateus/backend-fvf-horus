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
exports.FeriadosService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../common/audit/audit.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
let FeriadosService = class FeriadosService {
    prisma;
    audit;
    tenant;
    constructor(prisma, audit, tenant) {
        this.prisma = prisma;
        this.audit = audit;
        this.tenant = tenant;
    }
    async create(dto, grupoId, actorId) {
        if (dto.empresaId) {
            await this.tenant.verificarEmpresaNoGrupo(dto.empresaId, grupoId);
        }
        const feriado = await this.prisma.feriado.create({
            data: {
                data: new Date(dto.data),
                descricao: dto.descricao,
                empresaId: dto.empresaId,
                pagoComoDomingo: dto.pagoComoDomingo ?? true,
                grupoId,
                criadoPorUsuarioId: actorId,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: actorId ?? null,
            acao: 'FERIADO_CRIADO',
            entidade: 'Feriado',
            entidadeId: feriado.id,
            detalhes: {
                data: dto.data,
                descricao: dto.descricao,
                empresaId: dto.empresaId ?? null,
            },
        });
        return feriado;
    }
    list(grupoIdSolicitante) {
        return this.prisma.feriado.findMany({
            where: { grupoId: grupoIdSolicitante },
            orderBy: { data: 'asc' },
            include: {
                empresa: { select: { id: true, razaoSocial: true, cnpj: true } },
            },
        });
    }
    async findById(id, grupoIdSolicitante) {
        const feriado = await this.prisma.feriado.findUnique({
            where: { id },
            include: {
                empresa: { select: { id: true, razaoSocial: true, cnpj: true } },
            },
        });
        if (!feriado || feriado.grupoId !== grupoIdSolicitante) {
            throw new common_1.ForbiddenException('Feriado não pertence ao seu grupo');
        }
        return feriado;
    }
    async update(id, dto, grupoIdSolicitante, actorId) {
        await this.verificarPertence(id, grupoIdSolicitante);
        if (dto.empresaId) {
            await this.tenant.verificarEmpresaNoGrupo(dto.empresaId, grupoIdSolicitante);
        }
        const feriado = await this.prisma.feriado.update({
            where: { id },
            data: {
                ...(dto.data !== undefined ? { data: new Date(dto.data) } : {}),
                ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
                ...(dto.empresaId !== undefined ? { empresaId: dto.empresaId } : {}),
                ...(dto.pagoComoDomingo !== undefined
                    ? { pagoComoDomingo: dto.pagoComoDomingo }
                    : {}),
                ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: actorId ?? null,
            acao: 'FERIADO_ATUALIZADO',
            entidade: 'Feriado',
            entidadeId: id,
            detalhes: dto,
        });
        return feriado;
    }
    async desativar(id, grupoIdSolicitante, actorId) {
        await this.verificarPertence(id, grupoIdSolicitante);
        const feriado = await this.prisma.feriado.update({
            where: { id },
            data: { ativo: false },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: actorId ?? null,
            acao: 'FERIADO_DESATIVADO',
            entidade: 'Feriado',
            entidadeId: id,
            detalhes: {},
        });
        return feriado;
    }
    async verificarPertence(id, grupoIdSolicitante) {
        const feriado = await this.prisma.feriado.findUnique({
            where: { id },
            select: { grupoId: true },
        });
        if (!feriado)
            throw new common_1.NotFoundException('Feriado não encontrado');
        if (feriado.grupoId !== grupoIdSolicitante) {
            throw new common_1.ForbiddenException('Feriado não pertence ao seu grupo');
        }
    }
    async listarParaRelatorio(grupoId, empresaId, periodoInicio, periodoFim) {
        return this.prisma.feriado.findMany({
            where: {
                grupoId,
                ativo: true,
                data: { gte: periodoInicio, lte: periodoFim },
                OR: [{ empresaId: null }, { empresaId }],
            },
            orderBy: { data: 'asc' },
        });
    }
};
exports.FeriadosService = FeriadosService;
exports.FeriadosService = FeriadosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        tenant_service_1.TenantService])
], FeriadosService);
//# sourceMappingURL=feriados.service.js.map