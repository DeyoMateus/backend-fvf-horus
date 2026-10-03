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
var RelogioConfiavelService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelogioConfiavelService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const relogio_confiavel_util_1 = require("./relogio-confiavel.util");
let RelogioConfiavelService = RelogioConfiavelService_1 = class RelogioConfiavelService {
    prisma;
    logger = new common_1.Logger(RelogioConfiavelService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async registrarAmostraEResolverPendencias(motoristaId, deviceUuidUsado, elapsedRealtimeMs) {
        const horaServidor = new Date();
        await this.prisma.amostraHoraConfiavel.create({
            data: {
                motoristaId,
                deviceUuidUsado,
                elapsedRealtimeMsNoMomento: elapsedRealtimeMs,
                horaServidorNoMomento: horaServidor,
            },
        });
        const pendencias = await this.prisma.verificacaoRelogioPendente.findMany({
            where: { deviceUuidUsado, elapsedRealtimeMs: { lte: elapsedRealtimeMs } },
        });
        for (const pendencia of pendencias) {
            try {
                const divergenciaMin = (0, relogio_confiavel_util_1.calcularDivergenciaRelogioConfiavelMin)(pendencia.timestampEvento, pendencia.elapsedRealtimeMs, {
                    horaServidorNoMomento: horaServidor,
                    elapsedRealtimeMsNoMomento: elapsedRealtimeMs,
                });
                if (divergenciaMin > relogio_confiavel_util_1.TOLERANCIA_DIVERGENCIA_RELOGIO_CONFIAVEL_MIN) {
                    await this.prisma.alertaJornada.create({
                        data: {
                            motoristaId,
                            tipo: client_1.TipoAlertaJornada.RELOGIO_DIVERGENTE_DETECTADO_RETROATIVAMENTE,
                            severidade: client_1.SeveridadeAlerta.CRITICO,
                            mensagem: 'Divergência de relógio detectada retroativamente: este registro foi aceito logo após o ' +
                                'aparelho reiniciar, sem nenhuma hora confiável daquele boot disponível na hora. Comparando ' +
                                'agora com a primeira hora confiável que chegou desse mesmo boot, o relógio de parede e o ' +
                                'relógio monotônico do aparelho não batem , forte indício de que a data/hora do aparelho foi ' +
                                'alterada manualmente antes deste registro.',
                            janelaInicio: pendencia.timestampEvento,
                            janelaFim: pendencia.timestampEvento,
                            minutosAcumulados: Math.round(divergenciaMin),
                            registroGeradorId: pendencia.registroJornadaId,
                            detalhes: {
                                deviceUuidUsado,
                                divergenciaMin: Math.round(divergenciaMin),
                                elapsedRealtimeMsDoRegistro: pendencia.elapsedRealtimeMs,
                                elapsedRealtimeMsDaAmostra: elapsedRealtimeMs,
                            },
                        },
                    });
                }
            }
            catch (err) {
                this.logger.warn(`Falha ao resolver verificação de relógio pendente ${pendencia.id}: ${err.message}`);
            }
            await this.prisma.verificacaoRelogioPendente.delete({
                where: { id: pendencia.id },
            });
        }
        return { horaServidor };
    }
};
exports.RelogioConfiavelService = RelogioConfiavelService;
exports.RelogioConfiavelService = RelogioConfiavelService = RelogioConfiavelService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RelogioConfiavelService);
//# sourceMappingURL=relogio-confiavel.service.js.map