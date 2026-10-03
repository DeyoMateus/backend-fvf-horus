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
exports.RegrasSindicaisService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../common/audit/audit.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
let RegrasSindicaisService = class RegrasSindicaisService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async create(dto, grupoId, actorId) {
        const regra = await this.prisma.regraSindical.create({
            data: { ...dto, grupoId },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: actorId ?? null,
            acao: 'REGRA_SINDICAL_CRIADA',
            entidade: 'RegraSindical',
            entidadeId: regra.id,
            detalhes: { nome: regra.nome, grupoId },
        });
        return regra;
    }
    list(grupoIdSolicitante) {
        return this.prisma.regraSindical.findMany({
            where: { grupoId: grupoIdSolicitante },
            orderBy: { nome: 'asc' },
            include: {
                empresas: { select: { id: true, razaoSocial: true, cnpj: true } },
            },
        });
    }
    async findById(id, grupoIdSolicitante) {
        const regra = await this.prisma.regraSindical.findUnique({
            where: { id },
            include: {
                empresas: { select: { id: true, razaoSocial: true, cnpj: true } },
            },
        });
        if (!regra || regra.grupoId !== grupoIdSolicitante) {
            throw new common_1.ForbiddenException('Regra sindical não pertence ao seu grupo');
        }
        return regra;
    }
    async update(id, dto, grupoIdSolicitante, actorId) {
        await this.verificarPertence(id, grupoIdSolicitante);
        const regra = await this.prisma.regraSindical.update({
            where: { id },
            data: dto,
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: actorId ?? null,
            acao: 'REGRA_SINDICAL_ATUALIZADA',
            entidade: 'RegraSindical',
            entidadeId: id,
            detalhes: dto,
        });
        return regra;
    }
    async desativar(id, grupoIdSolicitante, actorId) {
        await this.verificarPertence(id, grupoIdSolicitante);
        const regra = await this.prisma.regraSindical.update({
            where: { id },
            data: { ativo: false },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: actorId ?? null,
            acao: 'REGRA_SINDICAL_DESATIVADA',
            entidade: 'RegraSindical',
            entidadeId: id,
            detalhes: {},
        });
        return regra;
    }
    async verificarPertence(id, grupoIdSolicitante) {
        const regra = await this.prisma.regraSindical.findUnique({
            where: { id },
            select: { grupoId: true },
        });
        if (!regra)
            throw new common_1.NotFoundException('Regra sindical não encontrada');
        if (regra.grupoId !== grupoIdSolicitante) {
            throw new common_1.ForbiddenException('Regra sindical não pertence ao seu grupo');
        }
    }
};
exports.RegrasSindicaisService = RegrasSindicaisService;
exports.RegrasSindicaisService = RegrasSindicaisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RegrasSindicaisService);
//# sourceMappingURL=regras-sindicais.service.js.map