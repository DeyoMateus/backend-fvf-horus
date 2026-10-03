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
exports.DossieCobrancaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma/prisma.service");
let DossieCobrancaService = class DossieCobrancaService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listar(grupoId, inicio, fim, motoristaId) {
        const alertas = await this.prisma.alertaJornada.findMany({
            where: {
                tipo: client_1.TipoAlertaJornada.ESPERA_LIMITE_LEGAL_ATINGIDO,
                motorista: {
                    empresa: { grupoId },
                    ...(motoristaId ? { id: motoristaId } : {}),
                },
                createdAt: { gte: inicio, lte: fim },
            },
            include: { motorista: { select: { id: true, nome: true, cpf: true } } },
            orderBy: { createdAt: 'asc' },
        });
        return alertas
            .map((alerta) => {
            const dossie = alerta.detalhes
                ?.dossieDeCobranca;
            if (!dossie)
                return null;
            return {
                alertaId: alerta.id,
                motoristaId: alerta.motorista.id,
                motoristaNome: alerta.motorista.nome,
                motoristaCpf: alerta.motorista.cpf,
                periodoInicio: dossie.periodoInicio,
                periodoFim: dossie.periodoFim,
                minutosTotais: dossie.minutosTotais,
                intervalos: dossie.intervalos,
                registroGeradorId: dossie.registroGeradorId,
                observacao: dossie.observacao,
                criadoEm: alerta.createdAt,
            };
        })
            .filter((item) => item !== null);
    }
};
exports.DossieCobrancaService = DossieCobrancaService;
exports.DossieCobrancaService = DossieCobrancaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DossieCobrancaService);
//# sourceMappingURL=dossie-cobranca.service.js.map