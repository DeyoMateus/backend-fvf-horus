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
var PrivacidadeAvisoPoliticaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivacidadeAvisoPoliticaService = exports.TIPO_PUSH_NOVA_POLITICA = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../common/audit/audit.service");
const push_notifications_service_1 = require("../common/notifications/push-notifications.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_context_1 = require("../common/tenant/tenant-context");
const privacidade_textos_1 = require("./privacidade.textos");
exports.TIPO_PUSH_NOVA_POLITICA = 'PRIVACIDADE_NOVA_VERSAO';
const ACAO_AUDITORIA = 'PRIVACIDADE_NOVA_VERSAO_AVISADA';
let PrivacidadeAvisoPoliticaService = class PrivacidadeAvisoPoliticaService {
    static { PrivacidadeAvisoPoliticaService_1 = this; }
    prisma;
    push;
    audit;
    logger = new common_1.Logger(PrivacidadeAvisoPoliticaService_1.name);
    timer = null;
    inicial = null;
    emExecucao = false;
    static REAVISO_MS = 12 * 60 * 60 * 1000;
    constructor(prisma, push, audit) {
        this.prisma = prisma;
        this.push = push;
        this.audit = audit;
    }
    onModuleInit() {
        if (process.env.NODE_ENV === 'test')
            return;
        const intervaloMs = Number(process.env.INTERVALO_AVISO_POLITICA_MS ?? 60 * 60 * 1000);
        this.timer = setInterval(() => void this.executar(), intervaloMs);
        this.inicial = setTimeout(() => void this.executar(), 30_000);
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
        if (this.inicial)
            clearTimeout(this.inicial);
    }
    async executar() {
        if (this.emExecucao)
            return 0;
        this.emExecucao = true;
        try {
            return await tenant_context_1.TenantContext.paraSistema(() => this.avisarPendentes());
        }
        catch (err) {
            this.logger.error('Falha ao avisar nova política', err);
            return 0;
        }
        finally {
            this.emExecucao = false;
        }
    }
    async avisarPendentes(agora = new Date()) {
        const tipos = Object.values(client_1.TipoDocumentoPrivacidade);
        const vinculos = await this.prisma.dispositivoVinculado.findMany({
            where: { pushToken: { not: null }, motorista: { status: client_1.StatusMotorista.ATIVO } },
            select: { motoristaId: true },
        });
        if (vinculos.length === 0)
            return 0;
        const ids = vinculos.map((v) => v.motoristaId);
        const aceites = await this.prisma.aceitePrivacidade.groupBy({
            by: ['motoristaId'],
            where: { motoristaId: { in: ids }, versao: privacidade_textos_1.VERSAO_DOCUMENTOS },
            _count: { tipoDocumento: true },
        });
        const completos = new Set(aceites
            .filter((a) => a._count.tipoDocumento >= tipos.length)
            .map((a) => a.motoristaId));
        const pendentes = ids.filter((id) => !completos.has(id));
        if (pendentes.length === 0)
            return 0;
        const corte = new Date(agora.getTime() - PrivacidadeAvisoPoliticaService_1.REAVISO_MS);
        const recentes = await this.prisma.auditLog.findMany({
            where: {
                acao: ACAO_AUDITORIA,
                entidadeId: { in: pendentes },
                createdAt: { gte: corte },
            },
            select: { entidadeId: true },
        });
        const jaAvisados = new Set(recentes.map((r) => r.entidadeId));
        let enviados = 0;
        for (const motoristaId of pendentes) {
            if (jaAvisados.has(motoristaId))
                continue;
            await this.push.notificarMotorista(motoristaId, 'Política de privacidade atualizada', 'Abra o app e confirme a ciência da nova versão para continuar usando.', { tipo: exports.TIPO_PUSH_NOVA_POLITICA, versao: privacidade_textos_1.VERSAO_DOCUMENTOS });
            await this.audit.registrar({
                actorType: client_1.ActorType.SISTEMA,
                actorId: null,
                acao: ACAO_AUDITORIA,
                entidade: 'AceitePrivacidade',
                entidadeId: motoristaId,
                detalhes: { versao: privacidade_textos_1.VERSAO_DOCUMENTOS },
            });
            enviados++;
        }
        if (enviados > 0) {
            this.logger.log(`Nova política ${privacidade_textos_1.VERSAO_DOCUMENTOS}: ${enviados} motorista(s) avisado(s) por push`);
        }
        return enviados;
    }
};
exports.PrivacidadeAvisoPoliticaService = PrivacidadeAvisoPoliticaService;
exports.PrivacidadeAvisoPoliticaService = PrivacidadeAvisoPoliticaService = PrivacidadeAvisoPoliticaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        push_notifications_service_1.PushNotificationsService,
        audit_service_1.AuditService])
], PrivacidadeAvisoPoliticaService);
//# sourceMappingURL=privacidade-aviso-politica.service.js.map