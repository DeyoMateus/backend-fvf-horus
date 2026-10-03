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
exports.TenantService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TenantService = class TenantService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async verificarEmpresaNoGrupo(empresaId, grupoId) {
        const empresa = await this.prisma.empresa.findUnique({
            where: { id: empresaId },
            select: { grupoId: true },
        });
        if (!empresa)
            throw new common_1.NotFoundException('Empresa não encontrada');
        if (empresa.grupoId !== grupoId) {
            throw new common_1.ForbiddenException('Empresa não pertence ao seu grupo');
        }
    }
    async verificarMotoristaNoGrupo(motoristaId, grupoId) {
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            select: { empresaId: true, empresa: { select: { grupoId: true } } },
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        if (motorista.empresa.grupoId !== grupoId) {
            throw new common_1.ForbiddenException('Motorista não pertence ao seu grupo');
        }
        return { empresaId: motorista.empresaId };
    }
    async verificarAjudanteNoGrupo(ajudanteId, grupoId) {
        const ajudante = await this.prisma.ajudante.findUnique({
            where: { id: ajudanteId },
            select: { empresaId: true, empresa: { select: { grupoId: true } } },
        });
        if (!ajudante)
            throw new common_1.NotFoundException('Ajudante não encontrado');
        if (ajudante.empresa.grupoId !== grupoId) {
            throw new common_1.ForbiddenException('Ajudante não pertence ao seu grupo');
        }
        return { empresaId: ajudante.empresaId };
    }
    async verificarMotoristaAtivo(motoristaId) {
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            select: { nome: true, status: true, excluidoEm: true },
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        if (motorista.excluidoEm) {
            throw new common_1.ForbiddenException(`${motorista.nome} está com o cadastro excluído , só é possível consultar o histórico dele, não lançar ou alterar nada novo.`);
        }
        if (motorista.status !== 'ATIVO') {
            throw new common_1.ForbiddenException(`${motorista.nome} está ${motorista.status === 'SUSPENSO' ? 'suspenso' : 'inativo'} , só é possível consultar o histórico dele, não lançar ou alterar nada novo.`);
        }
    }
    async verificarDocumentoCargaNoGrupo(documentoId, grupoId) {
        const documento = await this.prisma.documentoCarga.findUnique({
            where: { id: documentoId },
            select: { empresaId: true, empresa: { select: { grupoId: true } } },
        });
        if (!documento)
            throw new common_1.NotFoundException('Documento não encontrado');
        if (documento.empresa.grupoId !== grupoId) {
            throw new common_1.ForbiddenException('Documento não pertence ao seu grupo');
        }
        return { empresaId: documento.empresaId };
    }
};
exports.TenantService = TenantService;
exports.TenantService = TenantService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TenantService);
//# sourceMappingURL=tenant.service.js.map