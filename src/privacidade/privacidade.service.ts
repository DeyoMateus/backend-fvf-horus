import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  ActorType,
  Prisma,
  StatusSolicitacaoTitular,
  TipoDocumentoPrivacidade,
  TipoSolicitacaoTitular,
} from '@prisma/client';
import { normalizarPaginacao } from '../common/pagination/pagination.util';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  montarDocumentos,
  PRAZO_RESPOSTA_TITULAR_DIAS,
  VERSAO_DOCUMENTOS,
} from './privacidade.textos';
import type {
  AtualizarEncarregadoDto,
  ResponderSolicitacaoTitularDto,
} from './dto/privacidade.dto';

const LIMITE_EXPORTACAO = 20000;

export interface FiltroSolicitacoesTitular {
  status?: StatusSolicitacaoTitular;
  tipo?: TipoSolicitacaoTitular;
  busca?: string;
  dataInicio?: Date;
  dataFim?: Date;
  vencidas?: boolean;
  ordem?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

@Injectable()
export class PrivacidadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Texto público (sem dados de nenhuma empresa) , usado pela página web. */
  documentosPublicos() {
    return montarDocumentos(null);
  }

  /** Documentos do motorista (com controlador/encarregado da empresa dele) + o que ele já aceitou. */
  async obterParaMotorista(motoristaId: string) {
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
    if (!motorista) throw new NotFoundException('Motorista não encontrado');
    const aceites = await this.prisma.aceitePrivacidade.findMany({
      where: { motoristaId, versao: VERSAO_DOCUMENTOS },
      select: { tipoDocumento: true, aceitoEm: true },
    });
    const tipos = Object.values(TipoDocumentoPrivacidade);
    return {
      ...montarDocumentos(motorista.empresa),
      aceites: Object.fromEntries(
        tipos.map((t) => [
          t,
          aceites.find((a) => a.tipoDocumento === t)?.aceitoEm ?? null,
        ]),
      ),
      pendente: tipos.some((t) => !aceites.some((a) => a.tipoDocumento === t)),
    };
  }

  async registrarAceite(
    motoristaId: string,
    tipoDocumento: TipoDocumentoPrivacidade,
    versao: string,
    ip?: string | null,
  ) {
    if (versao !== VERSAO_DOCUMENTOS) {
      throw new BadRequestException(
        'A versão do documento mudou. Atualize a tela e leia a versão atual.',
      );
    }
    await this.prisma.aceitePrivacidade.upsert({
      where: {
        motoristaId_tipoDocumento_versao: { motoristaId, tipoDocumento, versao },
      },
      create: { motoristaId, tipoDocumento, versao },
      update: {},
    });
    await this.audit.registrar({
      actorType: ActorType.MOTORISTA,
      actorId: motoristaId,
      acao: 'PRIVACIDADE_CIENCIA_REGISTRADA',
      entidade: 'AceitePrivacidade',
      entidadeId: motoristaId,
      detalhes: { tipoDocumento, versao },
      ip: ip ?? null,
    });
    return this.obterParaMotorista(motoristaId);
  }

  async criarSolicitacao(
    motoristaId: string,
    tipo: TipoSolicitacaoTitular,
    descricao?: string,
  ) {
    const prazoEm = new Date(
      Date.now() + PRAZO_RESPOSTA_TITULAR_DIAS * 24 * 60 * 60 * 1000,
    );
    const criada = await this.prisma.solicitacaoTitular.create({
      data: { motoristaId, tipo, descricao: descricao || null, prazoEm },
    });
    await this.audit.registrar({
      actorType: ActorType.MOTORISTA,
      actorId: motoristaId,
      acao: 'PRIVACIDADE_SOLICITACAO_CRIADA',
      entidade: 'SolicitacaoTitular',
      entidadeId: criada.id,
      detalhes: { tipo },
    });
    return criada;
  }

  listarDoMotorista(motoristaId: string) {
    return this.prisma.solicitacaoTitular.findMany({
      where: { motoristaId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Painel: pedidos dos titulares do grupo (RLS já restringe ao grupo),
   * filtrável e paginado no servidor (mesmo padrão da trilha de auditoria).
   */
  async listarParaPainel(filtro: FiltroSolicitacoesTitular) {
    const pag = normalizarPaginacao(filtro.page, filtro.pageSize);
    const agora = new Date();
    const condicoes: Prisma.SolicitacaoTitularWhereInput[] = [];
    if (
      filtro.status &&
      Object.values(StatusSolicitacaoTitular).includes(filtro.status)
    ) {
      condicoes.push({ status: filtro.status });
    }
    if (
      filtro.tipo &&
      Object.values(TipoSolicitacaoTitular).includes(filtro.tipo)
    ) {
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
    const where: Prisma.SolicitacaoTitularWhereInput = condicoes.length
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

    const idsResp = Array.from(
      new Set(
        itens
          .map((i) => i.respondidaPorUsuarioId)
          .filter((x): x is string => !!x),
      ),
    );
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
        vencida:
          (i.status === 'ABERTA' || i.status === 'EM_ANALISE') &&
          i.prazoEm.getTime() < agora.getTime(),
      })),
      total,
      page: pag.page,
      pageSize: pag.pageSize,
      resumo: { abertas, emAnalise, vencidas },
    };
  }

  /** Pedidos novos (ainda não tocados) , alimenta o sininho do painel. */
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

  async responderSolicitacao(
    id: string,
    grupoId: string,
    usuarioId: string,
    dto: ResponderSolicitacaoTitularDto,
  ) {
    const s = await this.prisma.solicitacaoTitular.findFirst({
      where: { id, motorista: { empresa: { grupoId } } },
    });
    if (!s) throw new NotFoundException('Solicitação não encontrada');
    const final =
      dto.status === 'ATENDIDA' || dto.status === 'NEGADA_COM_JUSTIFICATIVA';
    if (final && dto.resposta.trim().length < 5) {
      throw new BadRequestException(
        'Informe a resposta ao titular (obrigatória ao concluir ou negar).',
      );
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
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'PRIVACIDADE_SOLICITACAO_RESPONDIDA',
      entidade: 'SolicitacaoTitular',
      entidadeId: id,
      detalhes: { status: dto.status },
    });
    return atualizada;
  }

  /** Quem já deu ciência da versão atual (painel). */
  async situacaoDasCiencias() {
    const motoristas = await this.prisma.motorista.findMany({
      where: { excluidoEm: null, status: 'ATIVO' },
      select: {
        id: true,
        nome: true,
        aceitesPrivacidade: {
          where: { versao: VERSAO_DOCUMENTOS },
          select: { tipoDocumento: true, aceitoEm: true },
        },
      },
      orderBy: { nome: 'asc' },
      take: 500,
    });
    return {
      versao: VERSAO_DOCUMENTOS,
      motoristas: motoristas.map((m) => ({
        id: m.id,
        nome: m.nome,
        politicaEm:
          m.aceitesPrivacidade.find((a) => a.tipoDocumento === 'POLITICA_PRIVACIDADE')
            ?.aceitoEm ?? null,
        termoGpsEm:
          m.aceitesPrivacidade.find((a) => a.tipoDocumento === 'TERMO_GPS')
            ?.aceitoEm ?? null,
        termoDadosEm:
          m.aceitesPrivacidade.find(
            (a) => a.tipoDocumento === 'TERMO_DADOS_PESSOAIS',
          )?.aceitoEm ?? null,
      })),
    };
  }

  async obterEncarregado(grupoId: string) {
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

  /** Define o encarregado de todos os CNPJs do grupo do usuário. */
  async atualizarEncarregado(
    grupoId: string,
    usuarioId: string,
    dto: AtualizarEncarregadoDto,
  ) {
    await this.prisma.empresa.updateMany({
      where: { grupoId },
      data: {
        encarregadoNome: dto.nome?.trim() || null,
        encarregadoEmail: dto.email?.trim() || null,
        encarregadoTelefone: dto.telefone?.trim() || null,
      },
    });
    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'PRIVACIDADE_ENCARREGADO_ATUALIZADO',
      entidade: 'Empresa',
      detalhes: { removido: !dto.nome?.trim() && !dto.email?.trim() },
    });
    return this.obterEncarregado(grupoId);
  }

  /** Direito de acesso/portabilidade: tudo que o sistema guarda sobre o motorista, em JSON. */
  async exportarDadosDoMotorista(motoristaId: string) {
    const [
      cadastro,
      registros,
      amostras,
      tratamentos,
      solicitacoesAjuste,
      alertas,
      aceites,
      solicitacoesTitular,
    ] = await Promise.all([
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
      actorType: ActorType.MOTORISTA,
      actorId: motoristaId,
      acao: 'PRIVACIDADE_EXPORTACAO_DADOS',
      entidade: 'Motorista',
      entidadeId: motoristaId,
    });
    return {
      geradoEm: new Date().toISOString(),
      aviso:
        'Cópia dos dados pessoais tratados pelo FVF Hórus sobre você (LGPD art. 18, II e V). Limitada aos registros mais recentes quando o volume é muito grande.',
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
}
