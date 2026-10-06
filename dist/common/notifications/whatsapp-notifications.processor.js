"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var WhatsappNotificationsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappNotificationsProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const whatsapp_notifications_constants_1 = require("./whatsapp-notifications.constants");
let WhatsappNotificationsProcessor = WhatsappNotificationsProcessor_1 = class WhatsappNotificationsProcessor extends bullmq_1.WorkerHost {
    logger = new common_1.Logger(WhatsappNotificationsProcessor_1.name);
    async process(job) {
        const { telefone, mensagem } = job.data;
        const evolutionUrl = process.env.EVOLUTION_API_URL;
        const evolutionKey = process.env.EVOLUTION_API_KEY;
        const evolutionInstancia = process.env.EVOLUTION_INSTANCE;
        if (evolutionUrl && evolutionKey && evolutionInstancia) {
            const resp = await fetch(`${evolutionUrl.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(evolutionInstancia)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: evolutionKey,
                },
                body: JSON.stringify({
                    number: telefone.replace(/\D/g, ''),
                    text: mensagem,
                }),
            }).catch((err) => {
                this.logger.error(`Evolution API inacessível (${evolutionUrl}): ${err.message}`);
                throw err;
            });
            if (!resp.ok) {
                const texto = await resp.text();
                this.logger.error(`Evolution API respondeu ${resp.status}: ${texto}`);
                throw new Error(`Evolution API respondeu ${resp.status}: ${texto}`);
            }
            this.logger.log(`WhatsApp enviado via Evolution para ***${telefone.slice(-4)}.`);
            return;
        }
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const token = process.env.WHATSAPP_TOKEN;
        if (!phoneNumberId || !token) {
            this.logger.warn('WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID ausentes , job não deveria ter sido enfileirado.');
            return;
        }
        const resposta = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: telefone.replace(/\D/g, ''),
                type: 'template',
                template: {
                    name: process.env.WHATSAPP_TEMPLATE_NOME ?? 'fvf_horus_alerta_critico',
                    language: { code: 'pt_BR' },
                    components: [
                        { type: 'body', parameters: [{ type: 'text', text: mensagem }] },
                    ],
                },
            }),
        });
        if (!resposta.ok) {
            const texto = await resposta.text();
            throw new Error(`WhatsApp Cloud API respondeu ${resposta.status}: ${texto}`);
        }
    }
};
exports.WhatsappNotificationsProcessor = WhatsappNotificationsProcessor;
exports.WhatsappNotificationsProcessor = WhatsappNotificationsProcessor = WhatsappNotificationsProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(whatsapp_notifications_constants_1.FILA_NOTIFICACOES_WHATSAPP)
], WhatsappNotificationsProcessor);
//# sourceMappingURL=whatsapp-notifications.processor.js.map