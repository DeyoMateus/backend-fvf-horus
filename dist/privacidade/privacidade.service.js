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
exports.PrivacidadeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const pagination_util_1 = require("../common/pagination/pagination.util");
const audit_service_1 = require("../common/audit/audit.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const privacidade_textos_1 = require("./privacidade.textos");
const privacidade_pdf_util_1 = require("./privacidade-pdf.util");
const LIMITE_EXPORTACAO = 20000;
let PrivacidadeService = class PrivacidadeService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    documentosPublicos() {
        return (0, privacidade_textos_1.montarDocumentos)(null);
    }
    async obterParaMotorista(motoristaId) {
        const motorista = await this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            select: {
                empresa: {
                    select: {
                        razaoSocial: true,
                        cnpj: true,
                        encarregadoNome: true,
                        encarregadoEmail: true,
                        encarregadoTelefone: true,
                    },
                },
            },
        });
        if (!motorista)
            throw new common_1.NotFoundException('Motorista não encontrado');
        const aceites = await this.prisma.aceitePrivacidade.findMany({
            where: { motoristaId, versao: privacidade_textos_1.VERSAO_DOCUMENTOS },
            select: { tipoDocumento: true, aceitoEm: true },
        });
        const tipos = Object.values(client_1.TipoDocumentoPrivacidade);
        return {
            ...(0, privacidade_textos_1.montarDocumentos)(motorista.empresa),
            aceites: Object.fromEntries(tipos.map((t) => [
                t,
                aceites.find((a) => a.tipoDocumento === t)?.aceitoEm ?? null,
            ])),
            pendente: tipos.some((t) => !aceites.some((a) => a.tipoDocumento === t)),
        };
    }
    async registrarAceite(motoristaId, tipoDocumento, versao, ip, aceitoLocalEm) {
        if (versao !== privacidade_textos_1.VERSAO_DOCUMENTOS) {
            throw new common_1.BadRequestException('A versão do documento mudou. Atualize a tela e leia a versão atual.');
        }
        const agora = new Date();
        let aceitoEm = agora;
        let offline = false;
        if (aceitoLocalEm) {
            const t = new Date(aceitoLocalEm);
            const ms = t.getTime();
            if (!Number.isNaN(ms) &&
                ms <= agora.getTime() + 10 * 60 * 1000 &&
                ms >= agora.getTime() - 30 * 24 * 60 * 60 * 1000) {
                aceitoEm = t;
                offline = true;
            }
        }
        await this.prisma.aceitePrivacidade.upsert({
            where: {
                motoristaId_tipoDocumento_versao: { motoristaId, tipoDocumento, versao },
            },
            create: { motoristaId, tipoDocumento, versao, aceitoEm },
            update: {},
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'PRIVACIDADE_CIENCIA_REGISTRADA',
            entidade: 'AceitePrivacidade',
            entidadeId: motoristaId,
            detalhes: {
                tipoDocumento,
                versao,
                ...(offline
                    ? {
                        aceitoOffline: true,
                        aceitoLocalEm: aceitoEm.toISOString(),
                        recebidoEm: agora.toISOString(),
                    }
                    : {}),
            },
            ip: ip ?? null,
        });
        return this.obterParaMotorista(motoristaId);
    }
    async criarSolicitacao(motoristaId, tipo, descricao) {
        const prazoEm = new Date(Date.now() + privacidade_textos_1.PRAZO_RESPOSTA_TITULAR_DIAS * 24 * 60 * 60 * 1000);
        const criada = await this.prisma.solicitacaoTitular.create({
            data: { motoristaId, tipo, descricao: descricao || null, prazoEm },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'PRIVACIDADE_SOLICITACAO_CRIADA',
            entidade: 'SolicitacaoTitular',
            entidadeId: criada.id,
            detalhes: { tipo },
        });
        return criada;
    }
    listarDoMotorista(motoristaId) {
        return this.prisma.solicitacaoTitular.findMany({
            where: { motoristaId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async listarParaPainel(filtro) {
        const pag = (0, pagination_util_1.normalizarPaginacao)(filtro.page, filtro.pageSize);
        const agora = new Date();
        const condicoes = [];
        if (filtro.status &&
            Object.values(client_1.StatusSolicitacaoTitular).includes(filtro.status)) {
            condicoes.push({ status: filtro.status });
        }
        if (filtro.tipo &&
            Object.values(client_1.TipoSolicitacaoTitular).includes(filtro.tipo)) {
            condicoes.push({ tipo: filtro.tipo });
        }
        if (filtro.busca?.trim()) {
            condicoes.push({
                motorista: {
                    nome: { contains: filtro.busca.trim(), mode: 'insensitive' },
                },
            });
        }
        if (filtro.dataInicio || filtro.dataFim) {
            condicoes.push({
                createdAt: {
                    ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}),
                    ...(filtro.dataFim ? { lte: filtro.dataFim } : {}),
                },
            });
        }
        if (filtro.vencidas) {
            condicoes.push({
                status: { in: ['ABERTA', 'EM_ANALISE'] },
                prazoEm: { lt: agora },
            });
        }
        const where = condicoes.length
            ? { AND: condicoes }
            : {};
        const [itens, total, abertas, emAnalise, vencidas] = await Promise.all([
            this.prisma.solicitacaoTitular.findMany({
                where,
                orderBy: { createdAt: filtro.ordem === 'asc' ? 'asc' : 'desc' },
                skip: pag.skip,
                take: pag.take,
                include: { motorista: { select: { id: true, nome: true } } },
            }),
            this.prisma.solicitacaoTitular.count({ where }),
            this.prisma.solicitacaoTitular.count({ where: { status: 'ABERTA' } }),
            this.prisma.solicitacaoTitular.count({ where: { status: 'EM_ANALISE' } }),
            this.prisma.solicitacaoTitular.count({
                where: {
                    status: { in: ['ABERTA', 'EM_ANALISE'] },
                    prazoEm: { lt: agora },
                },
            }),
        ]);
        const idsResp = Array.from(new Set(itens
            .map((i) => i.respondidaPorUsuarioId)
            .filter((x) => !!x)));
        const usuarios = idsResp.length
            ? await this.prisma.usuarioEmpresa.findMany({
                where: { id: { in: idsResp } },
                select: { id: true, nome: true },
            })
            : [];
        const nomePorId = new Map(usuarios.map((u) => [u.id, u.nome]));
        return {
            dados: itens.map((i) => ({
                ...i,
                respondidaPorNome: i.respondidaPorUsuarioId
                    ? (nomePorId.get(i.respondidaPorUsuarioId) ?? null)
                    : null,
                vencida: (i.status === 'ABERTA' || i.status === 'EM_ANALISE') &&
                    i.prazoEm.getTime() < agora.getTime(),
            })),
            total,
            page: pag.page,
            pageSize: pag.pageSize,
            resumo: { abertas, emAnalise, vencidas },
        };
    }
    async listarPendentesParaSino() {
        return this.prisma.solicitacaoTitular.findMany({
            where: { status: 'ABERTA' },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                tipo: true,
                createdAt: true,
                prazoEm: true,
                motorista: { select: { nome: true } },
            },
        });
    }
    async responderSolicitacao(id, grupoId, usuarioId, dto) {
        const s = await this.prisma.solicitacaoTitular.findFirst({
            where: { id, motorista: { empresa: { grupoId } } },
        });
        if (!s)
            throw new common_1.NotFoundException('Solicitação não encontrada');
        const final = dto.status === 'ATENDIDA' || dto.status === 'NEGADA_COM_JUSTIFICATIVA';
        if (final && dto.resposta.trim().length < 5) {
            throw new common_1.BadRequestException('Informe a resposta ao titular (obrigatória ao concluir ou negar).');
        }
        const atualizada = await this.prisma.solicitacaoTitular.update({
            where: { id },
            data: {
                status: dto.status,
                resposta: dto.resposta || null,
                respondidaEm: final ? new Date() : null,
                respondidaPorUsuarioId: final ? usuarioId : null,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'PRIVACIDADE_SOLICITACAO_RESPONDIDA',
            entidade: 'SolicitacaoTitular',
            entidadeId: id,
            detalhes: { status: dto.status },
        });
        return atualizada;
    }
    async situacaoDasCiencias() {
        const motoristas = await this.prisma.motorista.findMany({
            where: { excluidoEm: null, status: 'ATIVO' },
            select: {
                id: true,
                nome: true,
                aceitesPrivacidade: {
                    where: { versao: privacidade_textos_1.VERSAO_DOCUMENTOS },
                    select: { tipoDocumento: true, aceitoEm: true },
                },
            },
            orderBy: { nome: 'asc' },
            take: 500,
        });
        return {
            versao: privacidade_textos_1.VERSAO_DOCUMENTOS,
            motoristas: motoristas.map((m) => ({
                id: m.id,
                nome: m.nome,
                politicaEm: m.aceitesPrivacidade.find((a) => a.tipoDocumento === 'POLITICA_PRIVACIDADE')
                    ?.aceitoEm ?? null,
                termoGpsEm: m.aceitesPrivacidade.find((a) => a.tipoDocumento === 'TERMO_GPS')
                    ?.aceitoEm ?? null,
                termoDadosEm: m.aceitesPrivacidade.find((a) => a.tipoDocumento === 'TERMO_DADOS_PESSOAIS')?.aceitoEm ?? null,
            })),
        };
    }
    async obterEncarregado(grupoId) {
        return this.prisma.empresa.findMany({
            where: { grupoId },
            select: {
                id: true,
                razaoSocial: true,
                cnpj: true,
                encarregadoNome: true,
                encarregadoEmail: true,
                encarregadoTelefone: true,
            },
        });
    }
    async atualizarEncarregado(grupoId, usuarioId, dto) {
        await this.prisma.empresa.updateMany({
            where: { grupoId },
            data: {
                encarregadoNome: dto.nome?.trim() || null,
                encarregadoEmail: dto.email?.trim() || null,
                encarregadoTelefone: dto.telefone?.trim() || null,
            },
        });
        await this.audit.registrar({
            actorType: client_1.ActorType.USUARIO_EMPRESA,
            actorId: usuarioId,
            acao: 'PRIVACIDADE_ENCARREGADO_ATUALIZADO',
            entidade: 'Empresa',
            detalhes: { removido: !dto.nome?.trim() && !dto.email?.trim() },
        });
        return this.obterEncarregado(grupoId);
    }
    async exportarDadosDoMotorista(motoristaId) {
        const [cadastro, registros, amostras, tratamentos, solicitacoesAjuste, alertas, aceites, solicitacoesTitular,] = await Promise.all([
            this.prisma.motorista.findUnique({
                where: { id: motoristaId },
                select: {
                    nome: true,
                    cpf: true,
                    cnh: true,
                    telefone: true,
                    status: true,
                    createdAt: true,
                    empresa: { select: { razaoSocial: true, cnpj: true } },
                },
            }),
            this.prisma.registroJornada.findMany({
                where: { motoristaId },
                orderBy: { timestampEvento: 'desc' },
                take: LIMITE_EXPORTACAO,
                select: {
                    tipoEvento: true,
                    timestampEvento: true,
                    latitude: true,
                    longitude: true,
                    precisaoGpsM: true,
                    observacao: true,
                    fusoOffsetMin: true,
                    createdAt: true,
                },
            }),
            this.prisma.amostraLocalizacao.findMany({
                where: { motoristaId },
                orderBy: { capturadoEm: 'desc' },
                take: LIMITE_EXPORTACAO,
                select: { latitude: true, longitude: true, precisaoGpsM: true, capturadoEm: true },
            }),
            this.prisma.tratamentoPonto.findMany({
                where: { motoristaId },
                orderBy: { createdAt: 'desc' },
                take: 5000,
            }),
            this.prisma.solicitacaoAjustePonto.findMany({
                where: { motoristaId },
                orderBy: { createdAt: 'desc' },
                take: 5000,
            }),
            this.prisma.alertaJornada.findMany({
                where: { motoristaId },
                orderBy: { createdAt: 'desc' },
                take: 5000,
                select: { tipo: true, severidade: true, mensagem: true, createdAt: true },
            }),
            this.prisma.aceitePrivacidade.findMany({ where: { motoristaId } }),
            this.prisma.solicitacaoTitular.findMany({ where: { motoristaId } }),
        ]);
        await this.audit.registrar({
            actorType: client_1.ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'PRIVACIDADE_EXPORTACAO_DADOS',
            entidade: 'Motorista',
            entidadeId: motoristaId,
        });
        return {
            geradoEm: new Date().toISOString(),
            aviso: 'Cópia dos dados pessoais tratados pelo FVF Hórus sobre você (LGPD art. 18, II e V). Limitada aos registros mais recentes quando o volume é muito grande.',
            cadastro,
            registrosDeJornada: registros,
            amostrasDeLocalizacao: amostras,
            ajustesDePonto: tratamentos,
            solicitacoesDeAjuste: solicitacoesAjuste,
            alertas,
            cienciasDePrivacidade: aceites,
            pedidosDoTitular: solicitacoesTitular,
        };
    }
    async exportarDadosDoMotoristaPdf(motoristaId) {
        const dados = await this.exportarDadosDoMotorista(motoristaId);
        return (0, privacidade_pdf_util_1.gerarPdfMeusDados)(dados);
    }
};
exports.PrivacidadeService = PrivacidadeService;
exports.PrivacidadeService = PrivacidadeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PrivacidadeService);
//# sourceMappingURL=privacidade.service.js.map