import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { marcarHorario } from '../common/fuso/fuso-brasil.util';
import { ActorType, StatusSolicitacaoAjuste } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../common/audit/audit.service';
import { PushNotificationsService } from '../common/notifications/push-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { TenantService } from '../common/tenant/tenant.service';
import { TratamentosPontoService } from '../tratamentos-ponto/tratamentos-ponto.service';
import { CreateSolicitacaoAjusteDto } from './dto/create-solicitacao-ajuste.dto';
import { normalizarPaginacao } from '../common/pagination/pagination.util';
import {
  MENSAGEM_SO_IMAGEM,
  detectarTipoImagem,
  nomeComExtensaoDoTipo,
} from '../common/arquivos/arquivo-seguro.util';

// Rodada 73 , mesma política nova de TratamentosPontoService: até 4
// evidências por solicitação, 25MB cada, sempre no R2 (nunca cai pro
// Postgres).
const TAMANHO_MAXIMO_EVIDENCIA_BYTES = 25 * 1024 * 1024; // 25MB
const MAXIMO_EVIDENCIAS_POR_SOLICITACAO = 4;

const INCLUDE_PADRAO = {
  registroReferencia: {
    select: {
      id: true,
      sequencial: true,
      tipoEvento: true,
      timestampEvento: true,
    },
  },
  decididoPorUsuario: { select: { id: true, nome: true } },
  evidencias: {
    select: {
      id: true,
      nomeArquivo: true,
      contentType: true,
      tamanhoBytes: true,
      createdAt: true,
    },
  },
} as const;

/**
 * Fluxo "motorista pede, RH decide" (Rodada 27) , substitui, como via
 * principal, o antigo fluxo em que só o gestor lançava um ajuste direto
 * (esse continua existindo em TratamentosPontoService.create, pra casos
 * excepcionais em que é o próprio RH quem precisa corrigir sem pedido).
 *
 * Aprovar gera um TratamentoPonto de verdade (ancorado no ledger , ver
 * TratamentosPontoService.criarRegistroAncorado) e É esse registro que
 * entra na apuração/holerite. Rejeitar só marca o status: nada muda na
 * jornada do motorista.
 *
 * Cada decisão (aprovar/rejeitar) mexe SÓ na solicitação em questão ,
 * nunca em lote, nunca reabre nem altera nenhuma outra solicitação ou
 * TratamentoPonto já existente (decisão explícita do usuário, Rodada 27:
 * "uma contestação deve ser tratada apenas no caso do motorista sem
 * mexer nos demais fechamentos").
 */
@Injectable()
export class SolicitacoesAjustePontoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
    private readonly storage: StorageService,
    private readonly push: PushNotificationsService,
    private readonly tratamentosPontoService: TratamentosPontoService,
  ) {}

  // ===== App do motorista =====

  async criar(motoristaId: string, dto: CreateSolicitacaoAjusteDto) {
    if (dto.registroReferenciaId) {
      const referencia = await this.prisma.registroJornada.findUnique({
        where: { id: dto.registroReferenciaId },
      });
      if (!referencia || referencia.motoristaId !== motoristaId) {
        throw new BadRequestException(
          'registroReferenciaId não pertence a este motorista',
        );
      }
    }

    const solicitacao = await this.prisma.solicitacaoAjustePonto.create({
      data: {
        motoristaId,
        tipoEvento: dto.tipoEvento,
        timestampEvento: new Date(dto.timestampEvento),
        justificativa: dto.justificativa,
        registroReferenciaId: dto.registroReferenciaId,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.MOTORISTA,
      actorId: motoristaId,
      acao: 'SOLICITACAO_AJUSTE_PONTO_CRIADA',
      entidade: 'SolicitacaoAjustePonto',
      entidadeId: solicitacao.id,
      detalhes: {
        tipoEvento: dto.tipoEvento,
        timestampEvento: dto.timestampEvento,
      },
    });

    return solicitacao;
  }

  async listarMinhas(motoristaId: string) {
    return this.prisma.solicitacaoAjustePonto.findMany({
      where: { motoristaId },
      orderBy: { createdAt: 'desc' },
      include: INCLUDE_PADRAO,
    });
  }

  /** Anexa evidência a um pedido próprio , só enquanto ainda está PENDENTE (depois de decidido, não faz mais sentido mudar o que foi julgado). */
  async anexarEvidenciaDoMotorista(
    solicitacaoId: string,
    motoristaId: string,
    arquivo: Express.Multer.File,
  ) {
    const solicitacao = await this.prisma.solicitacaoAjustePonto.findUnique({
      where: { id: solicitacaoId },
    });
    if (!solicitacao || solicitacao.motoristaId !== motoristaId) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    if (solicitacao.status !== StatusSolicitacaoAjuste.PENDENTE) {
      throw new BadRequestException(
        'Esta solicitação já foi decidida, não é mais possível anexar evidências',
      );
    }
    return this.anexarEvidencia(solicitacao.id, arquivo);
  }

  /** Remove uma evidência anexada pelo próprio motorista , só enquanto a solicitação ainda está PENDENTE. */
  async removerEvidenciaDoMotorista(evidenciaId: string, motoristaId: string) {
    const evidencia =
      await this.prisma.solicitacaoAjustePontoEvidencia.findUnique({
        where: { id: evidenciaId },
      });
    if (!evidencia) throw new NotFoundException('Evidência não encontrada');
    const solicitacao = await this.prisma.solicitacaoAjustePonto.findUnique({
      where: { id: evidencia.solicitacaoId },
    });
    if (!solicitacao || solicitacao.motoristaId !== motoristaId) {
      throw new NotFoundException('Evidência não encontrada');
    }
    if (solicitacao.status !== StatusSolicitacaoAjuste.PENDENTE) {
      throw new BadRequestException(
        'Esta solicitação já foi decidida, não é mais possível remover evidências',
      );
    }
    await this.removerEvidencia(evidencia);
  }

  async baixarEvidenciaDoMotorista(evidenciaId: string, motoristaId: string) {
    const evidencia =
      await this.prisma.solicitacaoAjustePontoEvidencia.findUnique({
        where: { id: evidenciaId },
      });
    if (!evidencia) throw new NotFoundException('Evidência não encontrada');
    const solicitacao = await this.prisma.solicitacaoAjustePonto.findUnique({
      where: { id: evidencia.solicitacaoId },
    });
    if (!solicitacao || solicitacao.motoristaId !== motoristaId) {
      throw new NotFoundException('Evidência não encontrada');
    }
    return this.baixarEvidencia(evidenciaId);
  }

  // ===== Painel (RH/gestor) =====

  async listarPorMotorista(motoristaId: string, grupoIdSolicitante: string) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );
    return this.prisma.solicitacaoAjustePonto.findMany({
      where: { motoristaId },
      orderBy: { createdAt: 'desc' },
      include: INCLUDE_PADRAO,
    });
  }

  /** Todas as solicitações PENDENTES de qualquer motorista do grupo , pra um painel de "caixa de entrada" do RH. */
  async listarPendentesDoGrupo(grupoIdSolicitante: string) {
    return this.prisma.solicitacaoAjustePonto.findMany({
      where: {
        status: StatusSolicitacaoAjuste.PENDENTE,
        motorista: { empresa: { grupoId: grupoIdSolicitante } },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        ...INCLUDE_PADRAO,
        motorista: { select: { id: true, nome: true } },
      },
    });
  }

  /**
   * Histórico de solicitações JÁ DECIDIDAS (aprovadas/rejeitadas) de
   * qualquer motorista do grupo , pedido do usuário: a caixa de entrada
   * de pendentes "só mostra as em aberto mas não mostra as que já foram
   * fechadas, deve trazer o histórico do que já foi resolvido também".
   * Paginado no servidor (mesmo padrão de `DocumentosCargaService`,
   * Rodada 114), ordenado por quando foi decidida (não por quando foi
   * pedida , o que importa aqui é "resolvida quando").
   */
  async listarHistoricoDoGrupo(
    grupoIdSolicitante: string,
    page?: number,
    pageSize?: number,
    ordem?: 'asc' | 'desc',
  ) {
    const paginacao = normalizarPaginacao(page, pageSize);
    const where = {
      status: {
        in: [
          StatusSolicitacaoAjuste.APROVADA,
          StatusSolicitacaoAjuste.REJEITADA,
        ],
      },
      motorista: { empresa: { grupoId: grupoIdSolicitante } },
    };
    const [dados, total] = await Promise.all([
      this.prisma.solicitacaoAjustePonto.findMany({
        where,
        orderBy: { decididoEm: ordem ?? 'desc' },
        skip: paginacao.skip,
        take: paginacao.take,
        include: {
          ...INCLUDE_PADRAO,
          motorista: { select: { id: true, nome: true } },
        },
      }),
      this.prisma.solicitacaoAjustePonto.count({ where }),
    ]);
    return { dados, total, page: paginacao.page, pageSize: paginacao.pageSize };
  }

  async aprovar(
    solicitacaoId: string,
    motivoDecisao: string | undefined,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    const solicitacao = await this.buscarPendentePertencente(
      solicitacaoId,
      grupoIdSolicitante,
    );

    // Gera o TratamentoPonto oficial (mesma ancoragem no ledger do
    // lançamento direto do RH) , é este registro que entra na apuração.
    const tratamento = await this.tratamentosPontoService.criarRegistroAncorado(
      solicitacao.motoristaId,
      solicitacao.tipoEvento,
      solicitacao.timestampEvento,
      motivoDecisao?.trim()
        ? `Ajuste solicitado pelo motorista: ${solicitacao.justificativa} | Aprovado pelo RH: ${motivoDecisao}`
        : `Ajuste solicitado pelo motorista: ${solicitacao.justificativa}`,
      usuarioId,
      solicitacao.registroReferenciaId ?? undefined,
    );

    const atualizada = await this.prisma.solicitacaoAjustePonto.update({
      where: { id: solicitacaoId },
      data: {
        status: StatusSolicitacaoAjuste.APROVADA,
        decididoPorUsuarioId: usuarioId,
        decididoEm: new Date(),
        motivoDecisao,
        tratamentoPontoId: tratamento.id,
      },
      include: INCLUDE_PADRAO,
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'SOLICITACAO_AJUSTE_PONTO_APROVADA',
      entidade: 'SolicitacaoAjustePonto',
      entidadeId: solicitacaoId,
      detalhes: {
        motoristaId: solicitacao.motoristaId,
        tratamentoPontoId: tratamento.id,
      },
    });

    await this.push.notificarMotorista(
      solicitacao.motoristaId,
      'Pedido de ajuste aprovado',
      `Seu pedido de correção (${solicitacao.tipoEvento} em ${marcarHorario(solicitacao.timestampEvento)}) foi aprovado pela empresa.`,
      { tipo: 'SOLICITACAO_AJUSTE_APROVADA', solicitacaoId },
    );

    return atualizada;
  }

  async rejeitar(
    solicitacaoId: string,
    motivoDecisao: string,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    if (!motivoDecisao?.trim()) {
      throw new BadRequestException(
        'Informe o motivo da rejeição , o motorista precisa entender por quê',
      );
    }
    const solicitacao = await this.buscarPendentePertencente(
      solicitacaoId,
      grupoIdSolicitante,
    );

    const atualizada = await this.prisma.solicitacaoAjustePonto.update({
      where: { id: solicitacaoId },
      data: {
        status: StatusSolicitacaoAjuste.REJEITADA,
        decididoPorUsuarioId: usuarioId,
        decididoEm: new Date(),
        motivoDecisao,
      },
      include: INCLUDE_PADRAO,
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'SOLICITACAO_AJUSTE_PONTO_REJEITADA',
      entidade: 'SolicitacaoAjustePonto',
      entidadeId: solicitacaoId,
      detalhes: { motoristaId: solicitacao.motoristaId, motivoDecisao },
    });

    await this.push.notificarMotorista(
      solicitacao.motoristaId,
      'Pedido de ajuste não aprovado',
      `Seu pedido de correção (${solicitacao.tipoEvento} em ${marcarHorario(solicitacao.timestampEvento)}) não foi aprovado. Motivo: ${motivoDecisao}`,
      { tipo: 'SOLICITACAO_AJUSTE_REJEITADA', solicitacaoId },
    );

    return atualizada;
  }

  async baixarEvidenciaDoPainel(
    evidenciaId: string,
    grupoIdSolicitante: string,
  ) {
    const evidencia =
      await this.prisma.solicitacaoAjustePontoEvidencia.findUnique({
        where: { id: evidenciaId },
      });
    if (!evidencia) throw new NotFoundException('Evidência não encontrada');
    const solicitacao = await this.prisma.solicitacaoAjustePonto.findUnique({
      where: { id: evidencia.solicitacaoId },
    });
    if (!solicitacao) throw new NotFoundException('Evidência não encontrada');
    await this.tenant.verificarMotoristaNoGrupo(
      solicitacao.motoristaId,
      grupoIdSolicitante,
    );
    return this.baixarEvidencia(evidenciaId);
  }

  /** Remove uma evidência pelo painel (RH/gestor) , tenant check pela solicitação pai. */
  async removerEvidenciaDoPainel(
    evidenciaId: string,
    grupoIdSolicitante: string,
  ) {
    const evidencia =
      await this.prisma.solicitacaoAjustePontoEvidencia.findUnique({
        where: { id: evidenciaId },
      });
    if (!evidencia) throw new NotFoundException('Evidência não encontrada');
    const solicitacao = await this.prisma.solicitacaoAjustePonto.findUnique({
      where: { id: evidencia.solicitacaoId },
    });
    if (!solicitacao) throw new NotFoundException('Evidência não encontrada');
    await this.tenant.verificarMotoristaNoGrupo(
      solicitacao.motoristaId,
      grupoIdSolicitante,
    );
    // Pedido do usuário: nada pode ser excluído de um motorista
    // inativo/excluído tampouco , só consulta ao histórico.
    await this.tenant.verificarMotoristaAtivo(solicitacao.motoristaId);
    await this.removerEvidencia(evidencia);
  }

  // ===== Compartilhado =====

  private async buscarPendentePertencente(
    solicitacaoId: string,
    grupoIdSolicitante: string,
  ) {
    const solicitacao = await this.prisma.solicitacaoAjustePonto.findUnique({
      where: { id: solicitacaoId },
    });
    if (!solicitacao) throw new NotFoundException('Solicitação não encontrada');
    await this.tenant.verificarMotoristaNoGrupo(
      solicitacao.motoristaId,
      grupoIdSolicitante,
    );
    if (solicitacao.status !== StatusSolicitacaoAjuste.PENDENTE) {
      throw new BadRequestException('Esta solicitação já foi decidida');
    }
    // Pedido do usuário: motorista inativo/excluído não pode receber
    // NENHUM lançamento novo , aprovar gera um TratamentoPonto oficial,
    // então nem aprovar nem rejeitar passam daqui pra frente.
    await this.tenant.verificarMotoristaAtivo(solicitacao.motoristaId);
    return solicitacao;
  }

  private async anexarEvidencia(
    solicitacaoId: string,
    arquivo: Express.Multer.File,
  ) {
    // Rodada 192: só imagem, validada pelo CONTEÚDO (não pelo mimetype do cliente).
    const tipoImagem = detectarTipoImagem(arquivo.buffer);
    if (!tipoImagem) {
      throw new BadRequestException(MENSAGEM_SO_IMAGEM);
    }
    const nomeSeguro = nomeComExtensaoDoTipo(arquivo.originalname, tipoImagem);
    if (arquivo.size > TAMANHO_MAXIMO_EVIDENCIA_BYTES) {
      throw new BadRequestException('Arquivo maior que o limite de 25MB');
    }

    const quantidadeAtual =
      await this.prisma.solicitacaoAjustePontoEvidencia.count({
        where: { solicitacaoId },
      });
    if (quantidadeAtual >= MAXIMO_EVIDENCIAS_POR_SOLICITACAO) {
      throw new BadRequestException(
        `Esta solicitação já tem o máximo de ${MAXIMO_EVIDENCIAS_POR_SOLICITACAO} evidências anexadas , remova uma antes de anexar outra.`,
      );
    }

    // Rodada 73 , R2 obrigatório, nunca cai pro Postgres (ver mesma
    // decisão em TratamentosPontoService.anexarEvidencia).
    if (!this.storage.configurado()) {
      throw new BadRequestException(
        'Armazenamento de evidências (Cloudflare R2) não está configurado , peça para o administrador configurar as variáveis R2_* antes de anexar evidências.',
      );
    }

    const chaveR2 = `solicitacoes-ajuste-ponto/${solicitacaoId}/${randomUUID()}-${nomeSeguro}`;
    try {
      await this.storage.subirObjeto(chaveR2, arquivo.buffer, tipoImagem.mime);
    } catch (erro) {
      this.storage.logFalhaUpload(chaveR2, erro);
      throw new BadRequestException(
        'Falha ao enviar o arquivo para o armazenamento externo , tente novamente.',
      );
    }

    return this.prisma.solicitacaoAjustePontoEvidencia.create({
      data: {
        solicitacaoId,
        nomeArquivo: nomeSeguro,
        contentType: tipoImagem.mime,
        tamanhoBytes: arquivo.size,
        chaveStorage: chaveR2,
        conteudo: null,
      },
      select: {
        id: true,
        nomeArquivo: true,
        contentType: true,
        tamanhoBytes: true,
      },
    });
  }

  /** Exclui do R2 (se houver `chaveStorage`) e sempre a linha do Postgres , nunca um sem o outro. */
  private async removerEvidencia(evidencia: {
    id: string;
    chaveStorage: string | null;
  }): Promise<void> {
    if (evidencia.chaveStorage) {
      await this.storage.excluirObjeto(evidencia.chaveStorage);
    }
    await this.prisma.solicitacaoAjustePontoEvidencia.delete({
      where: { id: evidencia.id },
    });
  }

  private async baixarEvidencia(evidenciaId: string) {
    const evidencia =
      await this.prisma.solicitacaoAjustePontoEvidencia.findUnique({
        where: { id: evidenciaId },
      });
    if (!evidencia) throw new NotFoundException('Evidência não encontrada');

    if (evidencia.chaveStorage) {
      const conteudo = await this.storage.baixarObjeto(evidencia.chaveStorage);
      return { ...evidencia, conteudo };
    }
    if (!evidencia.conteudo) {
      throw new NotFoundException(
        'Arquivo desta evidência não foi encontrado nem no banco nem no storage externo',
      );
    }
    return { ...evidencia, conteudo: Buffer.from(evidencia.conteudo) };
  }
}
