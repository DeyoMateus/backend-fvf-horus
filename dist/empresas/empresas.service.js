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
exports.EmpresasService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../common/audit/audit.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
let EmpresasService = class EmpresasService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async create(dto, grupoId, actorId) {
        const existente = await this.prisma.empresa.findUnique({
            where: { cnpj: dto.cnpj },
        });
        if (existente)
            throw new common_1.ConflictException('CNPJ já cadastrado');
        const empresa = await this.prisma.empresa.create({
            data: { ...dto, grupoId },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: actorId ?? null,
            acao: 'EMPRESA_CRIADA',
            entidade: 'Empresa',
            entidadeId: empresa.id,
            detalhes: { grupoId },
        });
        return empresa;
    }
    async findById(id, grupoIdSolicitante) {
        const empresa = await this.prisma.empresa.findUnique({ where: { id } });
        if (!empresa || empresa.grupoId !== grupoIdSolicitante) {
            throw new common_1.ForbiddenException('Empresa não pertence ao seu grupo');
        }
        return empresa;
    }
    list(grupoIdSolicitante) {
        return this.prisma.empresa.findMany({
            where: { grupoId: grupoIdSolicitante },
            orderBy: { razaoSocial: 'asc' },
            include: { regraSindical: { select: { id: true, nome: true } } },
        });
    }
    async vincularRegraSindical(empresaId, regraSindicalId, grupoIdSolicitante, actorId) {
        const empresa = await this.prisma.empresa.findUnique({
            where: { id: empresaId },
        });
        if (!empresa || empresa.grupoId !== grupoIdSolicitante) {
            throw new common_1.ForbiddenException('Empresa não pertence ao seu grupo');
        }
        if (regraSindicalId) {
            const regra = await this.prisma.regraSindical.findUnique({
                where: { id: regraSindicalId },
            });
            if (!regra || regra.grupoId !== grupoIdSolicitante) {
                throw new common_1.ForbiddenException('Regra sindical não pertence ao seu grupo');
            }
        }
        const atualizada = await this.prisma.empresa.update({
            where: { id: empresaId },
            data: { regraSindicalId },
            include: { regraSindical: { select: { id: true, nome: true } } },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: actorId ?? null,
            acao: 'EMPRESA_REGRA_SINDICAL_VINCULADA',
            entidade: 'Empresa',
            entidadeId: empresaId,
            detalhes: { regraSindicalId },
        });
        return atualizada;
    }
};
exports.EmpresasService = EmpresasService;
exports.EmpresasService = EmpresasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], EmpresasService);
//# sourceMappingURL=empresas.service.js.map