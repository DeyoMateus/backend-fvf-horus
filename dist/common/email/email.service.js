"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
let EmailService = EmailService_1 = class EmailService {
    logger = new common_1.Logger(EmailService_1.name);
    configurado() {
        return !!process.env.RESEND_API_KEY;
    }
    async enviar(destinatario, assunto, corpoHtml) {
        if (!this.configurado()) {
            this.logger.warn(`[MODO SIMULADO , RESEND_API_KEY não configurada] E-mail não enviado de verdade.\n` +
                `Para: ${destinatario}\nAssunto: ${assunto}\n---\n${corpoHtml}\n---`);
            return;
        }
        try {
            await this.enviarViaProvedor(destinatario, assunto, corpoHtml);
        }
        catch (err) {
            this.logger.error(`Falha ao enviar e-mail para ${destinatario}`, err);
        }
    }
    async enviarViaProvedor(destinatario, assunto, corpoHtml) {
        const remetente = process.env.RESEND_FROM_EMAIL ?? 'FVF Hórus <onboarding@resend.dev>';
        const resposta = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: remetente,
                to: [destinatario],
                subject: assunto,
                html: corpoHtml,
            }),
        });
        if (!resposta.ok) {
            const texto = await resposta.text().catch(() => '');
            throw new Error(`Resend respondeu ${resposta.status}: ${texto}`);
        }
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)()
], EmailService);
//# sourceMappingURL=email.service.js.map