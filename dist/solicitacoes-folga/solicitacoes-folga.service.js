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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolicitacoesFolgaService = exports.MAXIMO_DIAS_POR_PEDIDO = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../common/audit/audit.service");
const fuso_brasil_util_1 = require("../common/fuso/fuso-brasil.util");
const minimizar_dados_whatsapp_util_1 = require("../common/notifications/minimizar-dados-whatsapp.util");
const push_notifications_service_1 = require("../common/notifications/push-notifications.service");
const whatsapp_notifications_service_1 = require("../common/notifications/whatsapp-notifications.service");
const pagination_util_1 = require("../common/pagination/pagination.util");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_service_1 = require("../common/tenant/tenant.service");
const folga_concedida_service_1 = require("../folga-concedida/folga-concedida.service");
exports.MAXIMO_DIAS_POR_PEDIDO = 15;
const DIA_MS = 86_400_000;
const INCLUDE_PADRAO = {
    decididoPorUsuario: { select: { id: true, nome: true } },
};
function paraDiaUtc(dia) {
    const [a, m, d] = dia.split('-').map(Number);
    const data = new Date(Date.UTC(a, m - 1, d));
    if (data.getUTCFullYear() !== a ||
        data.getUTCMonth() !== m - 1 ||
        data.getUTCDate() !== d) {
        throw new common_1.BadRequestException(`Data inválida: ${dia}`);
    }
    return data;
}
function formatarDia(d) {
    return d.toISOString().slice(0, 10).split('-').reverse().join('/');
}
function descreverPeriodo(inicio, fim) {
    return inicio.getTime() === fim.getTime()
        ? formatarDia(inicio)
        : `${formatarDia(inicio)} a ${formatarDia(fim)}`;
}
let SolicitacoesFolgaService = class SolicitacoesFolgaService {
    prisma;
    audit;
    tenant;
    push;
    whatsapp;
    folgaConcedida;
    constructor(prisma, audit, tenant, push, whatsapp, folgaConcedida) {
        this.prisma = prisma;
        this.audit = audit;
        this.tenant = tenant;
        this.push = push;
        this.whatsapp = whatsapp;
        this.folgaConcedida = folgaConcedida;
    }
    async criar(motoristaId, dto) {
        const inicio = paraDiaUtc(dto.dataInicio);
        const fim = paraDiaUtc(dto.dataFim);
        if (fim.getTime() < inicio.getTime()) {
            throw new common_1.BadRequestException('O último dia não pode ser antes do primeiro');
        }
        const dias = Math.round((fim.getTime() - inicio.getTime()) / DIA_MS) + 1;
        if (dias > exports.MAXIMO_DIAS_POR_PEDIDO) {
            throw new common_1.BadRequestException(`Cada pedido pode ter no máximo ${exports.MAXIMO_DIAS_POR_PEDIDO} dias seguidos`);
        }
        await this.tenant.verificarMotoristaAtivo(motoristaId);
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            include: { empresa: { select: { fusoHorario: true } } },
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        const hoje = (0, fuso_brasil_util_1.chaveDiaBrt)(new Date(), (0, fuso_brasil_util_1.offsetPadraoDaEmpresa)(motorista.empresa
            ?.fusoHorario));
        if (dto.dataInicio < hoje) {
            throw new common_1.BadRequestException('Só é possível pedir folga a partir de hoje. Para dias que já passaram, fale com o RH.');
        }
        const sobreposta = await this.prisma.solicitacaoFolga.findFirst({
            where: {
                motoristaId,
                status: client_1.StatusSolicitacaoFolga.PENDENTE,
                dataInicio: { lte: fim },
                dataFim: { gte: inicio },
            },
        });
        if (sobreposta) {
            throw new common_1.ConflictException('Você já tem um pedido de folga pendente que cobre algum desses dias');
        }
        const solicitacao = await this.prisma.solicitacaoFolga.create({
            data: {
                motoristaId,
                dataInicio: inicio,
                dataFim: fim,
                observacao: dto.observacao?.trim() || null,
            },
            include: INCLUDE_PADRAO,
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'SOLICITACAO_FOLGA_CRIADA',
            entidade: 'SolicitacaoFolga',
            entidadeId: solicitacao.id,
            detalhes: { dataInicio: dto.dataInicio, dataFim: dto.dataFim, dias },
        });
        void this.whatsapp.notificarGestoresDaEmpresa(motorista.empresaId, `${(0, minimizar_dados_whatsapp_util_1.nomeAbreviado)(motorista.nome)} pediu folga de ${descreverPeriodo(inicio, fim)}. Veja no painel.`);
        return solicitacao;
    }
    async listarMinhas(motoristaId) {
        return this.prisma.solicitacaoFolga.findMany({
            where: { motoristaId },
            orderBy: { createdAt: 'desc' },
            take: 30,
            include: INCLUDE_PADRAO,
        });
    }
    async listarPorMotorista(motoristaId, grupoIdSolicitante) {
        await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoIdSolicitante);
        return this.prisma.solicitacaoFolga.findMany({
            where: { motoristaId },
            orderBy: { createdAt: 'desc' },
            include: INCLUDE_PADRAO,
        });
    }
    async listarPendentesDoGrupo(grupoIdSolicitante) {
        return this.prisma.solicitacaoFolga.findMany({
            where: {
                status: client_1.StatusSolicitacaoFolga.PENDENTE,
                motorista: { empresa: { grupoId: grupoIdSolicitante } },
            },
            orderBy: { createdAt: 'asc' },
            include: {
                ...INCLUDE_PADRAO,
                motorista: { select: { id: true, nome: true } },
            },
        });
    }
    async contarPendentesDoGrupo(grupoIdSolicitante) {
        const total = await this.prisma.solicitacaoFolga.count({
            where: {
                status: client_1.StatusSolicitacaoFolga.PENDENTE,
                motorista: { empresa: { grupoId: grupoIdSolicitante } },
            },
        });
        return { total };
    }
    async listarHistoricoDoGrupo(grupoIdSolicitante, page, pageSize, ordem) {
        const paginacao = (0, pagination_util_1.normalizarPaginacao)(page, pageSize);
        const where = {
            status: {
                in: [client_1.StatusSolicitacaoFolga.APROVADA, client_1.StatusSolicitacaoFolga.NEGADA],
            },
            motorista: { empresa: { grupoId: grupoIdSolicitante } },
        };
        const [dados, total] = await Promise.all([
            this.prisma.solicitacaoFolga.findMany({
                where,
                orderBy: { decididoEm: ordem ?? 'desc' },
                skip: paginacao.skip,
                take: paginacao.take,
                include: {
                    ...INCLUDE_PADRAO,
                    motorista: { select: { id: true, nome: true } },
                },
            }),
            this.prisma.solicitacaoFolga.count({ where }),
        ]);
        return { dados, total, page: paginacao.page, pageSize: paginacao.pageSize };
    }
    async aprovar(solicitacaoId, motivoDecisao, usuarioId, grupoIdSolicitante) {
        const solicitacao = await this.buscarPendentePertencente(solicitacaoId, grupoIdSolicitante);
        const justificativa = motivoDecisao?.trim();
        const motivoFolga = justificativa
            ? `Folga pedida pelo motorista e aprovada pelo RH: ${justificativa}`
            : 'Folga pedida pelo motorista e aprovada pelo RH';
        const dias = [];
        for (let t = solicitacao.dataInicio.getTime(); t <= solicitacao.dataFim.getTime(); t += DIA_MS) {
            dias.push(new Date(t).toISOString().slice(0, 10));
        }
        let criadas = 0;
        for (const data of dias) {
            try {
                await this.folgaConcedida.conceder(solicitacao.motoristaId, { data, motivo: motivoFolga }, usuarioId, grupoIdSolicitante);
                criadas++;
            }
            catch (err) {
                if (!(err instanceof common_1.ConflictException))
                    throw err;
            }
        }
        const atualizada = await this.prisma.solicitacaoFolga.update({
            where: { id: solicitacaoId },
            data: {
                status: client_1.StatusSolicitacaoFolga.APROVADA,
                decididoPorUsuarioId: usuarioId,
                decididoEm: new Date(),
                motivoDecisao: justificativa || null,
            },
            include: INCLUDE_PADRAO,
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'SOLICITACAO_FOLGA_APROVADA',
            entidade: 'SolicitacaoFolga',
            entidadeId: solicitacaoId,
            detalhes: {
                motoristaId: solicitacao.motoristaId,
                dias: dias.length,
                folgasCriadas: criadas,
            },
        });
        await this.push.notificarMotorista(solicitacao.motoristaId, 'Pedido de folga aprovado', `Sua folga de ${descreverPeriodo(solicitacao.dataInicio, solicitacao.dataFim)} foi aprovada.${justificativa ? ` Observação do RH: ${justificativa}` : ''}`, { tipo: 'SOLICITACAO_FOLGA_APROVADA', solicitacaoId });
        return atualizada;
    }
    async negar(solicitacaoId, motivoDecisao, usuarioId, grupoIdSolicitante) {
        if (!motivoDecisao?.trim()) {
            throw new common_1.BadRequestException('Informe a justificativa , o motorista precisa entender por que a folga não foi aceita');
        }
        const solicitacao = await this.buscarPendentePertencente(solicitacaoId, grupoIdSolicitante);
        const justificativa = motivoDecisao.trim();
        const atualizada = await this.prisma.solicitacaoFolga.update({
            where: { id: solicitacaoId },
            data: {
                status: client_1.StatusSolicitacaoFolga.NEGADA,
                decididoPorUsuarioId: usuarioId,
                decididoEm: new Date(),
                motivoDecisao: justificativa,
            },
            include: INCLUDE_PADRAO,
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'SOLICITACAO_FOLGA_NEGADA',
            entidade: 'SolicitacaoFolga',
            entidadeId: solicitacaoId,
            detalhes: { motoristaId: solicitacao.motoristaId },
        });
        await this.push.notificarMotorista(solicitacao.motoristaId, 'Pedido de folga não aprovado', `Sua folga de ${descreverPeriodo(solicitacao.dataInicio, solicitacao.dataFim)} não foi aprovada. Motivo: ${justificativa}`, { tipo: 'SOLICITACAO_FOLGA_NEGADA', solicitacaoId });
        return atualizada;
    }
    async buscarPendentePertencente(solicitacaoId, grupoIdSolicitante) {
        const solicitacao = await this.prisma.solicitacaoFolga.findUnique({
            where: { id: solicitacaoId },
        });
        if (!solicitacao)
            throw new common_1.NotFoundException('Pedido não encontrado');
        await this.tenant.verificarMotoristaNoGrupo(solicitacao.motoristaId, grupoIdSolicitante);
        if (solicitacao.status !== client_1.StatusSolicitacaoFolga.PENDENTE) {
            throw new common_1.BadRequestException('Este pedido já foi decidido');
        }
        await this.tenant.verificarMotoristaAtivo(solicitacao.motoristaId);
        return solicitacao;
    }
};
exports.SolicitacoesFolgaService = SolicitacoesFolgaService;
exports.SolicitacoesFolgaService = SolicitacoesFolgaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        tenant_service_1.TenantService,
        push_notifications_service_1.PushNotificationsService,
        whatsapp_notifications_service_1.WhatsappNotificationsService,
        folga_concedida_service_1.FolgaConcedidaService])
], SolicitacoesFolgaService);
//# sourceMappingURL=solicitacoes-folga.service.js.map