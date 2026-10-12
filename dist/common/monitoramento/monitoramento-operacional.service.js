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
var MonitoramentoOperacionalService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoramentoOperacionalService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../audit/audit.service");
const email_service_1 = require("../email/email.service");
const whatsapp_notifications_service_1 = require("../notifications/whatsapp-notifications.service");
const prisma_service_1 = require("../prisma/prisma.service");
const REPETIR_ALERTA_A_CADA_MS = 6 * 60 * 60 * 1000;
const LIMITE_FALHAS_WHATSAPP_NA_HORA = 5;
let MonitoramentoOperacionalService = MonitoramentoOperacionalService_1 = class MonitoramentoOperacionalService {
    prisma;
    whatsapp;
    email;
    audit;
    logger = new common_1.Logger(MonitoramentoOperacionalService_1.name);
    timer = null;
    emExecucao = false;
    ultimoEstado = null;
    emProblema = new Map();
    constructor(prisma, whatsapp, email, audit) {
        this.prisma = prisma;
        this.whatsapp = whatsapp;
        this.email = email;
        this.audit = audit;
    }
    onModuleInit() {
        if (process.env.NODE_ENV === 'test')
            return;
        const intervalo = Number(process.env.INTERVALO_MONITORAMENTO_MS ?? 5 * 60 * 1000);
        this.timer = setInterval(() => void this.ciclo(), intervalo);
        setTimeout(() => void this.ciclo(), 30_000).unref();
        if (!this.canaisConfigurados()) {
            this.logger.warn('Monitoramento sem canal de aviso: defina ALERTA_OPERACIONAL_EMAIL e/ou ALERTA_WEBHOOK_URL para ser avisado quando o WhatsApp/Redis/banco falhar.');
        }
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    canaisConfigurados() {
        return !!(process.env.ALERTA_OPERACIONAL_EMAIL || process.env.ALERTA_WEBHOOK_URL);
    }
    async verificar() {
        const verificacoes = [];
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            verificacoes.push({ chave: 'banco', ok: true, detalhe: 'ok' });
        }
        catch {
            verificacoes.push({ chave: 'banco', ok: false, detalhe: 'banco de dados indisponível' });
        }
        const zap = await this.whatsapp.diagnostico();
        verificacoes.push({
            chave: 'redis',
            ok: zap.redis === 'ok',
            detalhe: zap.redis === 'ok' ? 'ok' : 'Redis (filas de notificação) indisponível',
        });
        if (zap.configurado) {
            const evolucaoOk = zap.evolution === 'ok' || zap.evolution === 'nao_configurada';
            verificacoes.push({
                chave: 'whatsapp_conexao',
                ok: evolucaoOk,
                detalhe: evolucaoOk
                    ? 'ok'
                    : zap.evolution === 'desconectada'
                        ? 'a instância do WhatsApp está desconectada (reescanear o QR Code)'
                        : 'a Evolution API não respondeu',
            });
            verificacoes.push({
                chave: 'whatsapp_envio',
                ok: zap.falhasUltimaHora < LIMITE_FALHAS_WHATSAPP_NA_HORA,
                detalhe: zap.falhasUltimaHora < LIMITE_FALHAS_WHATSAPP_NA_HORA
                    ? 'ok'
                    : `${zap.falhasUltimaHora} envios de WhatsApp falharam na última hora`,
            });
        }
        else {
            verificacoes.push({
                chave: 'whatsapp_configuracao',
                ok: false,
                detalhe: 'WhatsApp não configurado: nenhum alerta por WhatsApp será enviado',
            });
        }
        const estado = {
            saudavel: verificacoes.every((v) => v.ok),
            verificadoEm: new Date().toISOString(),
            verificacoes,
        };
        this.ultimoEstado = estado;
        return estado;
    }
    ultimo() {
        return this.ultimoEstado;
    }
    async ciclo() {
        if (this.emExecucao)
            return;
        this.emExecucao = true;
        try {
            const estado = await this.verificar();
            await this.processarTransicoes(estado.verificacoes);
        }
        catch (err) {
            this.logger.error('Falha no ciclo de monitoramento', err);
        }
        finally {
            this.emExecucao = false;
        }
    }
    async processarTransicoes(verificacoes) {
        const agora = Date.now();
        for (const v of verificacoes) {
            const avisadoEm = this.emProblema.get(v.chave);
            if (!v.ok) {
                if (avisadoEm === undefined || agora - avisadoEm >= REPETIR_ALERTA_A_CADA_MS) {
                    this.emProblema.set(v.chave, agora);
                    await this.avisar(`[FVF Hórus] PROBLEMA: ${v.detalhe}`, `Detectado em ${new Date(agora).toISOString()}. Enquanto isso não for resolvido, alertas de jornada podem não chegar aos gestores.`, v.chave, 'PROBLEMA');
                }
            }
            else if (avisadoEm !== undefined) {
                this.emProblema.delete(v.chave);
                await this.avisar(`[FVF Hórus] RESOLVIDO: ${v.chave}`, `A verificação "${v.chave}" voltou ao normal em ${new Date(agora).toISOString()}.`, v.chave, 'RESOLVIDO');
            }
        }
    }
    async avisar(titulo, corpo, chave, tipo) {
        this.logger.warn(`${titulo} | ${corpo}`);
        void this.audit.registrar({
            actorType: client_1.ActorType.SISTEMA,
            acao: 'MONITORAMENTO_OPERACIONAL',
            entidade: 'Sistema',
            detalhes: { chave, tipo, titulo },
        });
        const destinos = (process.env.ALERTA_OPERACIONAL_EMAIL ?? '')
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean);
        for (const destino of destinos) {
            await this.email.enviar(destino, titulo, `<p>${corpo}</p>`);
        }
        const webhook = process.env.ALERTA_WEBHOOK_URL;
        if (webhook) {
            try {
                await fetch(webhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: `${titulo}\n${corpo}`, content: `${titulo}\n${corpo}` }),
                    signal: AbortSignal.timeout(8_000),
                });
            }
            catch (err) {
                this.logger.error(`Webhook de alerta operacional falhou: ${err.message}`);
            }
        }
    }
};
exports.MonitoramentoOperacionalService = MonitoramentoOperacionalService;
exports.MonitoramentoOperacionalService = MonitoramentoOperacionalService = MonitoramentoOperacionalService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        whatsapp_notifications_service_1.WhatsappNotificationsService,
        email_service_1.EmailService,
        audit_service_1.AuditService])
], MonitoramentoOperacionalService);
//# sourceMappingURL=monitoramento-operacional.service.js.map