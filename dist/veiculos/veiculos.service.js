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
exports.VeiculosService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../common/audit/audit.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const normalizar_placa_util_1 = require("./normalizar-placa.util");
let VeiculosService = class VeiculosService {
    prisma;
    audit;
    tenant;
    constructor(prisma, audit, tenant) {
        this.prisma = prisma;
        this.audit = audit;
        this.tenant = tenant;
    }
    async atualizar(motoristaId, dto, ator, grupoIdSolicitante) {
        if (grupoIdSolicitante) {
            await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
            await this.tenant.verificarMotoristaAtivo(motoristaId);
        }
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            include: { empresa: true },
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        const placaNova = (0, normalizar_placa_util_1.normalizarPlaca)(dto.placa);
        const atual = await this.prisma.veiculoVinculado.findUnique({
            where: { motoristaId },
        });
        const trocouPlaca = !!atual && atual.placa !== placaNova;
        if (trocouPlaca || !atual) {
            const conflito = await this.prisma.veiculoVinculado.findFirst({
                where: {
                    placa: placaNova,
                    motoristaId: { not: motoristaId },
                    motorista: {
                        excluidoEm: null,
                        empresa: { grupoId: motorista.empresa.grupoId },
                    },
                },
                include: { motorista: true },
            });
            if (conflito) {
                throw new common_1.ConflictException(`A placa ${placaNova} já está vinculada a outro motorista (${conflito.motorista.nome}). Cada veículo só pode estar vinculado a um motorista por vez.`);
            }
        }
        const veiculo = await this.prisma.veiculoVinculado.upsert({
            where: { motoristaId },
            update: {
                placa: placaNova,
                idRastreador: dto.idRastreador,
                tecnologiaRastreador: dto.tecnologiaRastreador,
                atualizadoPorTipo: ator.tipo,
                atualizadoPorId: ator.id,
            },
            create: {
                motoristaId,
                placa: placaNova,
                idRastreador: dto.idRastreador,
                tecnologiaRastreador: dto.tecnologiaRastreador,
                atualizadoPorTipo: ator.tipo,
                atualizadoPorId: ator.id,
            },
        });
        const acao = !atual
            ? 'VEICULO_VINCULADO'
            : trocouPlaca
                ? 'VEICULO_TROCADO'
                : 'VEICULO_ATUALIZADO';
        await this.audit.registrar({
            actorType: ator.tipo,
            actorId: ator.id,
            acao,
            entidade: 'Motorista',
            entidadeId: motoristaId,
            detalhes: {
                placaAnterior: atual?.placa ?? null,
                placaNova,
                idRastreador: dto.idRastreador ?? null,
            },
        });
        return veiculo;
    }
    async status(motoristaId, grupoIdSolicitante) {
        if (grupoIdSolicitante) {
            await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        }
        const veiculo = await this.prisma.veiculoVinculado.findUnique({
            where: { motoristaId },
        });
        return veiculo ?? { vinculado: false };
    }
    async listarTrocas(motoristaId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        return this.prisma.auditLog.findMany({
            where: {
                entidade: 'Motorista',
                entidadeId: motoristaId,
                acao: 'VEICULO_TROCADO',
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
    }
};
exports.VeiculosService = VeiculosService;
exports.VeiculosService = VeiculosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        tenant_service_1.TenantService])
], VeiculosService);
//# sourceMappingURL=veiculos.service.js.map