"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushNotificationsModule = exports.FILA_NOTIFICACOES_PUSH = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const push_notifications_processor_1 = require("./push-notifications.processor");
const push_notifications_service_1 = require("./push-notifications.service");
const push_notifications_constants_1 = require("./push-notifications.constants");
Object.defineProperty(exports, "FILA_NOTIFICACOES_PUSH", { enumerable: true, get: function () { return push_notifications_constants_1.FILA_NOTIFICACOES_PUSH; } });
const whatsapp_notifications_processor_1 = require("./whatsapp-notifications.processor");
const whatsapp_notifications_service_1 = require("./whatsapp-notifications.service");
const whatsapp_notifications_constants_1 = require("./whatsapp-notifications.constants");
let PushNotificationsModule = class PushNotificationsModule {
};
exports.PushNotificationsModule = PushNotificationsModule;
exports.PushNotificationsModule = PushNotificationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.registerQueue({ name: push_notifications_constants_1.FILA_NOTIFICACOES_PUSH }),
            bullmq_1.BullModule.registerQueue({ name: whatsapp_notifications_constants_1.FILA_NOTIFICACOES_WHATSAPP }),
        ],
        providers: [
            push_notifications_service_1.PushNotificationsService,
            push_notifications_processor_1.PushNotificationsProcessor,
            whatsapp_notifications_service_1.WhatsappNotificationsService,
            whatsapp_notifications_processor_1.WhatsappNotificationsProcessor,
        ],
        exports: [push_notifications_service_1.PushNotificationsService, whatsapp_notifications_service_1.WhatsappNotificationsService],
    })
], PushNotificationsModule);
//# sourceMappingURL=push-notifications.module.js.map