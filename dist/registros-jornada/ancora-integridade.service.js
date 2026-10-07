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
var AncoraIntegridadeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AncoraIntegridadeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const audit_service_1 = require("../common/audit/audit.service");
const whatsapp_notifications_service_1 = require("../common/notifications/whatsapp-notifications.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const storage_service_1 = require("../common/storage/storage.service");
const tenant_context_1 = require("../common/tenant/tenant-context");
const PREFIXO = 'ancoras-integridade';
const CHAVE_ULTIMA = `${PREFIXO}/ultima.json`;
const REAVISO_MS = 24 * 60 * 60 * 1000;
let AncoraIntegridadeService = AncoraIntegridadeService_1 = class AncoraIntegridadeService {
    prisma;
    storage;
    whatsapp;
    audit;
    logger = new common_1.Logger(AncoraIntegridadeService_1.name);
    avisoStorageEmitido = false;
    avisados = new Map();
    constructor(prisma, storage, whatsapp, audit) {
        this.prisma = prisma;
        this.storage = storage;
        this.whatsapp = whatsapp;
        this.audit = audit;
    }
    chaveHmac() {
        const mestra = process.env.CRYPTO_MASTER_KEY;
        if (!mestra || mestra.length < 32) {
            throw new Error('CRYPTO_MASTER_KEY ausente: não dá para assinar a âncora.');
        }
        return Buffer.from((0, crypto_1.hkdfSync)('sha256', Buffer.from(mestra, 'hex'), Buffer.alloc(0), 'fvf-horus/ancora-integridade/v1', 32));
    }
    assinar(a) {
        const corpo = JSON.stringify({
            versao: a.versao,
            geradoEm: a.geradoEm,
            motoristas: a.motoristas,
        });
        return (0, crypto_1.createHmac)('sha256', this.chaveHmac()).update(corpo).digest('hex');
    }
    assinaturaConfere(a) {
        const esperado = Buffer.from(this.assinar(a), 'hex');
        const recebido = Buffer.from(String(a.assinatura ?? ''), 'hex');
        return (esperado.length === recebido.length && (0, crypto_1.timingSafeEqual)(esperado, recebido));
    }
    async montarSnapshot() {
        const linhas = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT m.id AS "motoristaId", m."empresaId" AS "empresaId", m.nome AS nome,
             COALESCE(c.total, 0)::int AS total,
             u.sequencial::int AS "ultimoSequencial",
             u."hashAtual" AS "ultimoHash"
      FROM motoristas m
      LEFT JOIN (
        SELECT "motoristaId", count(*) AS total
        FROM registros_jornada GROUP BY "motoristaId"
      ) c ON c."motoristaId" = m.id
      LEFT JOIN (
        SELECT DISTINCT ON ("motoristaId") "motoristaId", sequencial, "hashAtual"
        FROM registros_jornada
        ORDER BY "motoristaId", sequencial DESC
      ) u ON u."motoristaId" = m.id
      ORDER BY m.id
    `);
        return linhas.map((l) => ({
            motoristaId: l.motoristaId,
            empresaId: l.empresaId,
            nome: l.nome,
            total: Number(l.total),
            ultimoSequencial: l.ultimoSequencial === null ? null : Number(l.ultimoSequencial),
            ultimoHash: l.ultimoHash,
        }));
    }
    async lerUltima() {
        let buffer;
        try {
            buffer = await this.storage.baixarObjeto(CHAVE_ULTIMA);
        }
        catch (err) {
            if (/respondeu 404/.test(err.message))
                return { tipo: 'ausente' };
            throw err;
        }
        try {
            const a = JSON.parse(buffer.toString('utf8'));
            if (a.versao !== 1 || !Array.isArray(a.motoristas))
                return { tipo: 'adulterada' };
            if (!this.assinaturaConfere(a))
                return { tipo: 'adulterada' };
            return { tipo: 'ok', ancora: a };
        }
        catch {
            return { tipo: 'adulterada' };
        }
    }
    async gravarUltima(snapshot, agora) {
        const a = {
            versao: 1,
            geradoEm: agora.toISOString(),
            motoristas: snapshot,
        };
        const assinada = { ...a, assinatura: this.assinar(a) };
        const corpo = Buffer.from(JSON.stringify(assinada), 'utf8');
        await this.storage.subirObjeto(CHAVE_ULTIMA, corpo, 'application/json');
        const chaveDia = `${PREFIXO}/${agora.toISOString().slice(0, 10)}.json`;
        try {
            await this.storage.baixarObjeto(chaveDia);
        }
        catch (err) {
            if (/respondeu 404/.test(err.message)) {
                await this.storage.subirObjeto(chaveDia, corpo, 'application/json');
            }
            else {
                throw err;
            }
        }
    }
    async registrarArquivo(pasta, conteudo, agora) {
        try {
            await this.storage.subirObjeto(`${PREFIXO}/${pasta}/${agora.toISOString()}.json`, Buffer.from(JSON.stringify(conteudo, null, 2), 'utf8'), 'application/json');
        }
        catch (err) {
            this.logger.warn(`Não consegui gravar ${pasta} no R2: ${err.message}`);
        }
    }
    async compararComAncora(ancora, snapshot) {
        const atual = new Map(snapshot.map((m) => [m.motoristaId, m]));
        const violacoes = [];
        const comUltimo = ancora.motoristas.filter((m) => m.ultimoSequencial !== null && atual.has(m.motoristaId));
        const existentes = comUltimo.length
            ? await this.prisma.registroJornada.findMany({
                where: {
                    OR: comUltimo.map((m) => ({
                        motoristaId: m.motoristaId,
                        sequencial: m.ultimoSequencial,
                    })),
                },
                select: { motoristaId: true, sequencial: true, hashAtual: true },
            })
            : [];
        const hashExistente = new Map(existentes.map((r) => [`${r.motoristaId}:${r.sequencial}`, r.hashAtual]));
        for (const m of ancora.motoristas) {
            const cur = atual.get(m.motoristaId);
            if (!cur) {
                violacoes.push({ motorista: m, motivo: 'motorista não existe mais' });
                continue;
            }
            if (cur.total < m.total) {
                violacoes.push({
                    motorista: m,
                    motivo: `tinha ${m.total} evento(s) e agora tem ${cur.total}`,
                });
                continue;
            }
            if (m.ultimoSequencial !== null) {
                const hash = hashExistente.get(`${m.motoristaId}:${m.ultimoSequencial}`);
                if (hash === undefined) {
                    violacoes.push({
                        motorista: m,
                        motivo: `o evento nº ${m.ultimoSequencial} não existe mais`,
                    });
                }
                else if (hash !== m.ultimoHash) {
                    violacoes.push({
                        motorista: m,
                        motivo: `o evento nº ${m.ultimoSequencial} foi alterado`,
                    });
                }
            }
        }
        return violacoes;
    }
    async reportar(violacoes, geradoEm, agora, adulterada, empresasParaAvisar = []) {
        if (adulterada) {
            const k = '__ancora_adulterada__';
            if (agora.getTime() - (this.avisados.get(k) ?? 0) < REAVISO_MS)
                return;
            this.avisados.set(k, agora.getTime());
            for (const empresaId of empresasParaAvisar) {
                void this.whatsapp.notificarGestoresDaEmpresa(empresaId, 'Integridade: o ponto de verificação externo da cadeia de registros não confere com a assinatura (adulterado ou chave diferente). Verifique o banco e o bucket.');
            }
        }
        const novas = violacoes.filter((v) => {
            const k = `${v.motorista.motoristaId}:${v.motivo}`;
            const ultimo = this.avisados.get(k) ?? 0;
            return agora.getTime() - ultimo >= REAVISO_MS;
        });
        if (novas.length === 0 && !adulterada)
            return;
        for (const v of novas)
            this.avisados.set(`${v.motorista.motoristaId}:${v.motivo}`, agora.getTime());
        await this.registrarArquivo('incidentes', { adulterada, ancoraDe: geradoEm, violacoes }, agora);
        try {
            await this.audit.registrar({
                actorType: client_1.ActorType.SISTEMA,
                acao: 'INTEGRIDADE_ANCORA_VIOLADA',
                entidade: 'Sistema',
                detalhes: {
                    adulterada,
                    ancoraDe: geradoEm,
                    violacoes: violacoes.map((v) => ({
                        motoristaId: v.motorista.motoristaId,
                        motivo: v.motivo,
                    })),
                },
            });
        }
        catch (err) {
            this.logger.warn(`Auditoria da violação falhou: ${err.message}`);
        }
        for (const v of novas) {
            try {
                const ultimo = await this.prisma.registroJornada.findFirst({
                    where: { motoristaId: v.motorista.motoristaId },
                    orderBy: { sequencial: 'desc' },
                    select: { id: true, timestampEvento: true },
                });
                if (!ultimo)
                    continue;
                const assinatura = `ancora:${geradoEm}:${v.motorista.motoristaId}`;
                const jaTem = (await this.prisma.alertaJornada.findMany({
                    where: {
                        motoristaId: v.motorista.motoristaId,
                        tipo: 'INTEGRIDADE_CADEIA_VIOLADA',
                    },
                    select: { detalhes: true },
                })).some((a) => a.detalhes?.assinatura ===
                    assinatura);
                if (jaTem)
                    continue;
                await this.prisma.alertaJornada.create({
                    data: {
                        motoristaId: v.motorista.motoristaId,
                        tipo: 'INTEGRIDADE_CADEIA_VIOLADA',
                        severidade: 'CRITICO',
                        mensagem: `Integridade violada: comparando com o último ponto de verificação ` +
                            `guardado fora do banco, ${v.motivo}. Possível exclusão ou alteração ` +
                            `direta no banco de dados.`,
                        janelaInicio: ultimo.timestampEvento,
                        janelaFim: ultimo.timestampEvento,
                        minutosAcumulados: 0,
                        registroGeradorId: ultimo.id,
                        detalhes: {
                            assinatura,
                            motivo: v.motivo,
                            origem: 'ancora_externa',
                        },
                    },
                });
            }
            catch (err) {
                this.logger.warn(`Falha ao criar alerta da âncora (${v.motorista.motoristaId}): ${err.message}`);
            }
        }
        const porEmpresa = new Map();
        for (const v of novas) {
            const l = porEmpresa.get(v.motorista.empresaId) ?? [];
            l.push(v);
            porEmpresa.set(v.motorista.empresaId, l);
        }
        for (const [empresaId, lista] of porEmpresa) {
            const nomes = lista
                .slice(0, 5)
                .map((v) => `${v.motorista.nome} (${v.motivo})`)
                .join('; ');
            const resto = lista.length > 5 ? ` e mais ${lista.length - 5}` : '';
            void this.whatsapp.notificarGestoresDaEmpresa(empresaId, `Integridade violada: registros ausentes ou alterados no banco em relação ao último ponto de verificação externo. ${nomes}${resto}. Possível exclusão direta no banco.`);
        }
        if (adulterada) {
            this.logger.error('A âncora guardada no R2 não confere com a assinatura (adulterada ou chave diferente).');
        }
    }
    async executar() {
        if (!this.storage.configurado()) {
            if (!this.avisoStorageEmitido) {
                this.avisoStorageEmitido = true;
                this.logger.warn('R2 não configurado: âncora de integridade desligada.');
            }
            return { estado: 'sem_storage' };
        }
        return tenant_context_1.TenantContext.paraSistema(async () => {
            const agora = new Date();
            const snapshot = await this.montarSnapshot();
            const anterior = await this.lerUltima();
            const hoje = agora.toISOString().slice(0, 10);
            const reiniciarHoje = process.env.INTEGRIDADE_ANCORA_REINICIAR === hoje;
            if (anterior.tipo === 'ausente' || reiniciarHoje) {
                if (reiniciarHoje && anterior.tipo === 'ok') {
                    await this.registrarArquivo('reinicios', { anterior: anterior.ancora }, agora);
                    this.logger.warn('Âncora de integridade REINICIADA por INTEGRIDADE_ANCORA_REINICIAR (vale só hoje).');
                }
                await this.gravarUltima(snapshot, agora);
                return {
                    estado: anterior.tipo === 'ausente' ? 'baseline_criada' : 'reiniciada',
                    motoristas: snapshot.length,
                };
            }
            if (anterior.tipo === 'adulterada') {
                await this.reportar([], 'desconhecida', agora, true, [
                    ...new Set(snapshot.map((m) => m.empresaId)),
                ]);
                return { estado: 'ancora_adulterada' };
            }
            const violacoes = await this.compararComAncora(anterior.ancora, snapshot);
            if (violacoes.length > 0) {
                await this.reportar(violacoes, anterior.ancora.geradoEm, agora, false);
                return {
                    estado: 'violacao',
                    motoristas: snapshot.length,
                    violacoes: violacoes.length,
                };
            }
            await this.gravarUltima(snapshot, agora);
            return { estado: 'ok', motoristas: snapshot.length };
        });
    }
};
exports.AncoraIntegridadeService = AncoraIntegridadeService;
exports.AncoraIntegridadeService = AncoraIntegridadeService = AncoraIntegridadeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        storage_service_1.StorageService,
        whatsapp_notifications_service_1.WhatsappNotificationsService,
        audit_service_1.AuditService])
], AncoraIntegridadeService);
//# sourceMappingURL=ancora-integridade.service.js.map