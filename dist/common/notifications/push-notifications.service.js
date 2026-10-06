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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PushNotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushNotificationsService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
const fuso_brasil_util_1 = require("../fuso/fuso-brasil.util");
const push_notifications_constants_1 = require("./push-notifications.constants");
let PushNotificationsService = PushNotificationsService_1 = class PushNotificationsService {
    fila;
    prisma;
    logger = new common_1.Logger(PushNotificationsService_1.name);
    constructor(fila, prisma) {
        this.fila = fila;
        this.prisma = prisma;
    }
    async notificarMotorista(motoristaId, titulo, corpo, dados) {
        try {
            const vinculo = await this.prisma.dispositivoVinculado.findUnique({
                where: { motoristaId },
                select: { pushToken: true },
            });
            if (!vinculo?.pushToken)
                return;
            await this.fila.add('enviar', {
                pushToken: vinculo.pushToken,
                titulo,
                corpo: (0, fuso_brasil_util_1.renderizarHorarios)(corpo, await this.offsetAtualDoMotorista(motoristaId)),
                dados,
            }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5_000 },
                removeOnComplete: true,
                removeOnFail: 50,
            });
        }
        catch (err) {
            this.logger.error(`Falha ao enfileirar notificação push para motorista ${motoristaId}`, err);
        }
    }
    async offsetAtualDoMotorista(motoristaId) {
        try {
            const ultimo = await this.prisma.registroJornada.findFirst({
                where: { motoristaId, fusoOffsetMin: { not: null } },
                orderBy: { timestampEvento: 'desc' },
                select: { fusoOffsetMin: true },
            });
            return ultimo?.fusoOffsetMin ?? -180;
        }
        catch {
            return -180;
        }
    }
};
exports.PushNotificationsService = PushNotificationsService;
exports.PushNotificationsService = PushNotificationsService = PushNotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(push_notifications_constants_1.FILA_NOTIFICACOES_PUSH)),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        prisma_service_1.PrismaService])
], PushNotificationsService);
//# sourceMappingURL=push-notifications.service.js.map