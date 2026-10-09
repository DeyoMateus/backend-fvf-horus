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
const SOM_POR_TIPO = {
    DIRECAO_CONTINUA_PROXIMA_LIMITE: 'direcao_300',
    DIRECAO_CONTINUA_EXCEDIDA: 'direcao_330',
    DIRECAO_RETOMADA_SEM_PAUSA: 'direcao_330',
    JORNADA_DIRECAO_PROXIMA_LIMITE: 'jornada_proxima',
    JORNADA_DIRECAO_EXCEDIDA: 'jornada_excedida',
    ESPERA_PROXIMA_LIMITE: 'espera_proxima',
    ESPERA_LIMITE_LEGAL_ATINGIDO: 'espera_limite',
    TEMPO_INDEFINIDO_PROXIMO_LIMITE: 'indefinido_15',
    TEMPO_INDEFINIDO_PROLONGADO: 'indefinido_30',
};
function canalDoPush(dados) {
    const tipo = typeof dados?.tipo === 'string' ? dados.tipo : undefined;
    if (!tipo ||
        tipo.startsWith('SOLICITACAO_') ||
        tipo === 'TRATAMENTO_PONTO') {
        return 'alertas-jornada-v2';
    }
    return `alerta-voz-${SOM_POR_TIPO[tipo] ?? 'generico'}-v1`;
}
const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
let PushNotificationsProcessor = PushNotificationsProcessor_1 = class PushNotificationsProcessor extends bullmq_1.WorkerHost {
    logger = new common_1.Logger(PushNotificationsProcessor_1.name);
    async conferirRecibo(ticketId) {
        try {
            await new Promise((r) => setTimeout(r, 15_000));
            const r = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ ids: [ticketId] }),
            });
            const json = (await r.json());
            const rec = json.data?.[ticketId];
            if (rec?.status === 'error') {
                this.logger.warn(`Push NÃO entregue (${rec.details?.error ?? 'erro'}): ${rec.message ?? ''}`);
            }
            else if (rec?.status === 'ok') {
                this.logger.log('Push entregue ao Google/Apple (recibo ok).');
            }
        }
        catch {
        }
    }
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
                channelId: canalDoPush(dados),
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
        else if (corpoResposta.data?.id) {
            void this.conferirRecibo(corpoResposta.data.id);
        }
    }
};
exports.PushNotificationsProcessor = PushNotificationsProcessor;
exports.PushNotificationsProcessor = PushNotificationsProcessor = PushNotificationsProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(push_notifications_constants_1.FILA_NOTIFICACOES_PUSH)
], PushNotificationsProcessor);
//# sourceMappingURL=push-notifications.processor.js.map