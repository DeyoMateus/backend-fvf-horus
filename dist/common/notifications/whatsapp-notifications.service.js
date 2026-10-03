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
var WhatsappNotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappNotificationsService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
const whatsapp_notifications_constants_1 = require("./whatsapp-notifications.constants");
let WhatsappNotificationsService = WhatsappNotificationsService_1 = class WhatsappNotificationsService {
    fila;
    prisma;
    logger = new common_1.Logger(WhatsappNotificationsService_1.name);
    constructor(fila, prisma) {
        this.fila = fila;
        this.prisma = prisma;
    }
    configurado() {
        return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
    }
    async notificarGestoresDaEmpresa(empresaId, mensagem) {
        if (!this.configurado())
            return;
        try {
            const empresa = await this.prisma.empresa.findUnique({
                where: { id: empresaId },
                select: { grupoId: true },
            });
            if (!empresa)
                return;
            const gestores = await this.prisma.usuarioEmpresa.findMany({
                where: {
                    grupoId: empresa.grupoId,
                    ativo: true,
                    telefoneWhatsapp: { not: null },
                },
                select: { telefoneWhatsapp: true },
            });
            for (const gestor of gestores) {
                if (!gestor.telefoneWhatsapp)
                    continue;
                await this.fila.add('enviar', { telefone: gestor.telefoneWhatsapp, mensagem }, {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 5_000 },
                    removeOnComplete: true,
                    removeOnFail: 50,
                });
            }
        }
        catch (err) {
            this.logger.error(`Falha ao enfileirar notificação WhatsApp para empresa ${empresaId}`, err);
        }
    }
};
exports.WhatsappNotificationsService = WhatsappNotificationsService;
exports.WhatsappNotificationsService = WhatsappNotificationsService = WhatsappNotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(whatsapp_notifications_constants_1.FILA_NOTIFICACOES_WHATSAPP)),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        prisma_service_1.PrismaService])
], WhatsappNotificationsService);
//# sourceMappingURL=whatsapp-notifications.service.js.map