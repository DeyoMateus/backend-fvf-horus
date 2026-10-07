"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PushNotificationsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushNotificationsProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const push_notifications_constants_1 = require("./push-notifications.constants");
const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
let PushNotificationsProcessor = PushNotificationsProcessor_1 = class PushNotificationsProcessor extends bullmq_1.WorkerHost {
    logger = new common_1.Logger(PushNotificationsProcessor_1.name);
    async process(job) {
        const { pushToken, titulo, corpo, dados } = job.data;
        const resposta = await fetch(EXPO_PUSH_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                to: pushToken,
                title: titulo,
                body: corpo,
                data: dados ?? {},
                priority: 'high',
                sound: 'default',
                channelId: 'alertas-jornada-v2',
            }),
        });
        if (!resposta.ok) {
            const texto = await resposta.text();
            throw new Error(`Expo Push API respondeu ${resposta.status}: ${texto}`);
        }
        const corpoResposta = (await resposta.json());
        if (corpoResposta.data?.status === 'error') {
            this.logger.warn(`Expo Push API recusou o envio: ${corpoResposta.data.message}`);
        }
    }
};
exports.PushNotificationsProcessor = PushNotificationsProcessor;
exports.PushNotificationsProcessor = PushNotificationsProcessor = PushNotificationsProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(push_notifications_constants_1.FILA_NOTIFICACOES_PUSH)
], PushNotificationsProcessor);
//# sourceMappingURL=push-notifications.processor.js.map