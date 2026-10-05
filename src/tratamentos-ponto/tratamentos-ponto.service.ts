import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  marcarHorario,
  offsetValido,
} from '../common/fuso/fuso-brasil.util';
import { ActorType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../common/audit/audit.service';
import { HashChainService } from '../common/hash-chain/hash-chain.service';
import { PushNotificationsService } from '../common/notifications/push-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { TenantService } from '../common/tenant/tenant.service';
import { RegistrosJornadaService } from '../registros-jornada/registros-jornada.service';
import { CreateTratamentoPontoDto } from './dto/create-tratamento-ponto.dto';
import {
  EventoLinhaDoTempo,
  validarSequenciaAjuste,
} from './validacao-sequencia-ajuste';

// Rodada 73 , pedido do usuário: até 4 imagens de até 25MB cada por
// tratamento, e elas NUNCA podem ser gravadas no Postgres , sempre
// direto pro R2 (bucket de object storage), com só o link
// (`chaveStorage`) guardado aqui. Isso é uma mudança de política em
// relação ao padrão fail-open usado pra XML de CT-e/MDF-e em
// DocumentosCargaService (que ainda cai pro Postgres se o R2 não
// estiver configurado): imagem de evidência pode ser grande e se
// acumular muito mais que um XML por motorista, então aqui o R2
// passa a ser OBRIGATÓRIO , sem ele configurado, o anexo é
// recusado com uma mensagem clara em vez de cair silenciosamente
// pro banco.
const TAMANHO_MAXIMO_EVIDENCIA_BYTES = 25 * 1024 * 1024; // 25MB
const MAXIMO_EVIDENCIAS_POR_TRATAMENTO = 4;

/**
 * Tratamento de ponto: correção/justificativa lançada pelo RH/gestor ,
 * nunca pelo motorista, e nunca alterando um RegistroJornada existente
 * (isso continua impossível: tanto pela ausência de rota de update/delete
 * quanto pelo trigger WORM no banco).
 *
 * É um registro paralelo, só informativo (sem workflow de aprovação),
 * mas ainda assim ancorado criptograficamente no ledger real do
 * motorista: `hashReferencia` é o hashAtual do último evento dele no
 * momento do ajuste (ou o hashGenesis, se ainda não tiver nenhum), e
 * `hashRegistro` é o fingerprint do próprio ajuste. Isso prova sobre
 * qual estado exato da cadeia o RH estava enxergando quando lançou a
 * correção , útil se depois surgir dúvida sobre a ordem dos fatos.
 *
 * Rodada 26: todo "fechamento de ponto" (o gestor lançando um evento que
 * o motorista esqueceu de bater) deve vir acompanhado de evidência
 * (anexarEvidencia) e é enviado por push pro app do motorista assim que
 * criado , ele nunca fica sabendo só quando for tarde. O motorista pode
 * discordar, mas isso é resolvido conversando com a empresa: não existe
 * fluxo de contestação dentro do sistema, de propósito (ver decisão do
 * usuário na Rodada 26).
 */
@Injectable()
export class TratamentosPontoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashChain: HashChainService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
    private readonly storage: StorageService,
    private readonly push: PushNotificationsService,
    private readonly registrosJornada: RegistrosJornadaService,
  ) {}

  async create(
    motoristaId: string,
    dto: CreateTratamentoPontoDto,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );
    // Pedido do usuário: motorista inativo/excluído não pode receber
    // NENHUM lançamento novo , só consulta ao que já existe.
    await this.tenant.verificarMotoristaAtivo(motoristaId);

    const tratamento = await this.criarRegistroAncorado(
      motoristaId,
      dto.tipoEvento,
      new Date(dto.timestampEvento),
      dto.motivo,
      usuarioId,
      dto.registroReferenciaId,
      dto.fusoOffsetMin,
    );

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'TRATAMENTO_PONTO_CRIADO',
      entidade: 'TratamentoPonto',
      entidadeId: tratamento.id,
      detalhes: { motoristaId, tipoEvento: dto.tipoEvento, motivo: dto.motivo },
    });

    // Fail-open, de propósito: a notificação nunca pode impedir o ajuste
    // de ser salvo. O motorista também vê o ajuste em "meus-ajustes" no
    // app mesmo se o push falhar ou o token não existir.
    await this.push.notificarMotorista(
      motoristaId,
      'Ajuste no seu ponto',
      `A empresa registrou um ajuste (${dto.tipoEvento}) referente a ${marcarHorario(new Date(dto.timestampEvento))}. Toque para ver o motivo e os comprovantes.`,
      { tipo: 'TRATAMENTO_PONTO', tratamentoId: tratamento.id },
    );

    return tratamento;
  }

  /**
   * Rodada 150 , em que fuso o motorista estava no instante do ajuste: o que
   * o painel mandou (o gestor digitou a hora no fuso dele) ou, se não veio,
   * o do último ponto dele ANTES daquele instante (senão o primeiro depois).
   * Nunca o de onde o motorista está hoje nem o do computador do gestor.
   */
  private async fusoDoMotoristaNoInstante(
    motoristaId: string,
    instante: Date,
    informado?: number | null,
  ): Promise<number | null> {
    if (offsetValido(informado)) return informado;
    try {
      const antes = await this.prisma.registroJornada.findFirst({
        where: {
          motoristaId,
          timestampEvento: { lte: instante },
          fusoOffsetMin: { not: null },
        },
        orderBy: { timestampEvento: 'desc' },
        select: { fusoOffsetMin: true },
      });
      if (antes?.fusoOffsetMin != null) return antes.fusoOffsetMin;
      const depois = await this.prisma.registroJornada.findFirst({
        where: {
          motoristaId,
          timestampEvento: { gt: instante },
          fusoOffsetMin: { not: null },
        },
        orderBy: { timestampEvento: 'asc' },
        select: { fusoOffsetMin: true },
      });
      return depois?.fusoOffsetMin ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Rodada 139 , monta a linha do tempo UNIFICADA do motorista (registros
   * reais + ajustes já lançados, mesma fonte que o holerite usa pra
   * calcular as horas) em volta do horário do ajuste e confere se o
   * tipo escolhido encaixa na jornada.
   */
  private async validarEncaixeNaJornada(
    motoristaId: string,
    tipoEvento: CreateTratamentoPontoDto['tipoEvento'],
    timestampEvento: Date,
  ) {
    const [regAnt, tratAnt, regPost, tratPost] = await Promise.all([
      this.prisma.registroJornada.findMany({
        where: { motoristaId, timestampEvento: { lte: timestampEvento } },
        orderBy: [{ timestampEvento: 'desc' }, { sequencial: 'desc' }],
        take: 100,
        select: { tipoEvento: true, timestampEvento: true },
      }),
      this.prisma.tratamentoPonto.findMany({
        where: { motoristaId, timestampEvento: { lte: timestampEvento } },
        orderBy: [{ timestampEvento: 'desc' }, { createdAt: 'desc' }],
        take: 100,
        select: { tipoEvento: true, timestampEvento: true },
      }),
      this.prisma.registroJornada.findMany({
        where: { motoristaId, timestampEvento: { gt: timestampEvento } },
        orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
        take: 20,
        select: { tipoEvento: true, timestampEvento: true },
      }),
      this.prisma.tratamentoPonto.findMany({
        where: { motoristaId, timestampEvento: { gt: timestampEvento } },
        orderBy: [{ timestampEvento: 'asc' }, { createdAt: 'asc' }],
        take: 20,
        select: { tipoEvento: true, timestampEvento: true },
      }),
    ]);
    const porHorario = (a: EventoLinhaDoTempo, b: EventoLinhaDoTempo) =>
      a.timestampEvento.getTime() - b.timestampEvento.getTime();
    const anteriores = [...regAnt, ...tratAnt].sort(porHorario);
    const posteriores = [...regPost, ...tratPost].sort(porHorario);
    return validarSequenciaAjuste(tipoEvento, anteriores, posteriores);
  }

  /** Rodada 139 , pra o painel saber o que pode ser lançado num horário. */
  async contextoDoAjuste(
    motoristaId: string,
    timestampEvento: Date,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );
    const todos = [
      'INICIO_JORNADA',
      'INICIO_DESCANSO',
      'FIM_DESCANSO',
      'INICIO_DIRECAO',
      'FIM_DIRECAO',
      'ESPERA_CARGA_DESCARGA',
      'FIM_ESPERA_CARGA_DESCARGA',
      'FIM_DESCARREGAMENTO',
      'FIM_JORNADA',
      'OUTRO',
    ] as const;
    const permitidos: string[] = [];
    for (const t of todos) {
      const r = await this.validarEncaixeNaJornada(
        motoristaId,
        t,
        timestampEvento,
      );
      if (r.ok) permitidos.push(t);
    }
    return { permitidos };
  }

  /**
   * Núcleo da ancoragem no hash-chain do motorista , extraído de `create`
   * pra ser reaproveitado pelo fluxo de solicitação de ajuste (Rodada 27):
   * quando o RH APROVA um pedido do motorista, o TratamentoPonto final
   * nasce exatamente igual a um lançamento direto do RH (mesma prova
   * criptográfica), só que quem chama é `SolicitacoesAjustePontoService`
   * em vez do controller de lançamento direto. Não faz tenant check nem
   * audit/push , isso é responsabilidade de quem chama, porque o
   * ator/mensagem muda conforme a origem (lançamento direto vs. aprovação).
   */
  async criarRegistroAncorado(
    motoristaId: string,
    tipoEvento: CreateTratamentoPontoDto['tipoEvento'],
    timestampEvento: Date,
    motivo: string,
    usuarioId: string,
    registroReferenciaId?: string,
    fusoOffsetMin?: number | null,
  ) {
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');

    const usuario = await this.prisma.usuarioEmpresa.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    if (registroReferenciaId) {
      const referencia = await this.prisma.registroJornada.findUnique({
        where: { id: registroReferenciaId },
      });
      if (!referencia || referencia.motoristaId !== motoristaId) {
        throw new BadRequestException(
          'registroReferenciaId não pertence a este motorista',
        );
      }
    }

    // Rodada 139 , o ajuste precisa se encaixar numa jornada (ver
    // validacao-sequencia-ajuste.ts).
    const validacao = await this.validarEncaixeNaJornada(
      motoristaId,
      tipoEvento,
      timestampEvento,
    );
    if (!validacao.ok) throw new BadRequestException(validacao.mensagem);

    const ultimoRegistro = await this.prisma.registroJornada.findFirst({
      where: { motoristaId },
      orderBy: { sequencial: 'desc' },
    });
    const hashReferencia = ultimoRegistro?.hashAtual ?? motorista.hashGenesis;
    const fusoDoAjuste = await this.fusoDoMotoristaNoInstante(
      motoristaId,
      timestampEvento,
      fusoOffsetMin,
    );

    const canonico = JSON.stringify({
      motivo,
      motoristaId,
      registroReferenciaId: registroReferenciaId ?? null,
      timestampEvento: timestampEvento.toISOString(),
      tipoEvento,
      usuarioId,
    });
    const hashRegistro = this.hashChain.sha256(`${hashReferencia}|${canonico}`);

    const tratamento = await this.prisma.tratamentoPonto.create({
      data: {
        motoristaId,
        usuarioId,
        tipoEvento,
        timestampEvento,
        motivo,
        registroReferenciaId,
        fusoOffsetMin: fusoDoAjuste,
        hashReferencia,
        hashRegistro,
      },
    });

    // Rodada 93 , pedido do usuário: alertas de jornada aberta
    // (tempo indefinido, direção excedida) continuavam disparando
    // mesmo depois do gestor lançar um ajuste de FIM_JORNADA, porque
    // a verificação agendada só olhava pro ledger real
    // (RegistroJornada), que nunca muda com um ajuste (WORM, de
    // propósito). Reavalia aqui, na hora (best-effort, nunca pode
    // impedir o ajuste de ser salvo) , se este ajuste fechar a
    // jornada, `verificarEAgendarProximoMotorista` já cancela
    // qualquer verificação pendente e para de gerar alerta novo.
    void this.registrosJornada
      .verificarEAgendarProximoMotorista(motoristaId)
      .catch((err: Error) => {
        this.audit.registrar({
          actorType: ActorType.SISTEMA,
          acao: 'REVERIFICACAO_JORNADA_APOS_AJUSTE_FALHA',
          entidade: 'TratamentoPonto',
          entidadeId: tratamento.id,
          detalhes: { erro: err.message },
        });
      });

    return tratamento;
  }

  async listByMotorista(motoristaId: string, grupoIdSolicitante?: string) {
    if (grupoIdSolicitante) {
      await this.tenant.verificarMotoristaNoGrupo(
        motoristaId,
        grupoIdSolicitante,
      );
    }
    return this.prisma.tratamentoPonto.findMany({
      where: { motoristaId },
      orderBy: { timestampEvento: 'asc' },
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        evidencias: {
          select: {
            id: true,
            nomeArquivo: true,
            contentType: true,
            tamanhoBytes: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Anexa uma evidência (print de rastreador, print de WhatsApp etc.) a
   * um tratamento já existente. Sobe pro R2 se configurado; senão guarda
   * os bytes direto no Postgres , mesmo padrão de fallback do XML de
   * CT-e/MDF-e em DocumentosCargaService.
   */
  async anexarEvidencia(
    tratamentoId: string,
    arquivo: Express.Multer.File,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    if (arquivo.size > TAMANHO_MAXIMO_EVIDENCIA_BYTES) {
      throw new BadRequestException('Arquivo maior que o limite de 25MB');
    }
    const tratamento = await this.prisma.tratamentoPonto.findUnique({
      where: { id: tratamentoId },
    });
    if (!tratamento) throw new NotFoundException('Tratamento não encontrado');
    await this.tenant.verificarMotoristaNoGrupo(
      tratamento.motoristaId,
      grupoIdSolicitante,
    );
    // Pedido do usuário: motorista inativo/excluído não pode receber
    // NENHUM lançamento novo , só consulta ao que já existe.
    await this.tenant.verificarMotoristaAtivo(tratamento.motoristaId);

    const quantidadeAtual = await this.prisma.tratamentoPontoEvidencia.count({
      where: { tratamentoId },
    });
    if (quantidadeAtual >= MAXIMO_EVIDENCIAS_POR_TRATAMENTO) {
      throw new BadRequestException(
        `Este tratamento já tem o máximo de ${MAXIMO_EVIDENCIAS_POR_TRATAMENTO} evidências anexadas , remova uma antes de anexar outra.`,
      );
    }

    // Rodada 73 , R2 passa a ser obrigatório pra evidência (nunca cai
    // pro Postgres): recusa com mensagem clara em vez de guardar o
    // arquivo no banco.
    if (!this.storage.configurado()) {
      throw new BadRequestException(
        'Armazenamento de evidências (Cloudflare R2) não está configurado , peça para o administrador configurar as variáveis R2_* antes de anexar evidências.',
      );
    }

    const chaveR2 = `tratamentos-ponto/${tratamentoId}/${randomUUID()}-${arquivo.originalname}`;
    try {
      await this.storage.subirObjeto(chaveR2, arquivo.buffer, arquivo.mimetype);
    } catch (erro) {
      this.storage.logFalhaUpload(chaveR2, erro);
      throw new BadRequestException(
        'Falha ao enviar o arquivo para o armazenamento externo , tente novamente.',
      );
    }

    const evidencia = await this.prisma.tratamentoPontoEvidencia.create({
      data: {
        tratamentoId,
        nomeArquivo: arquivo.originalname,
        contentType: arquivo.mimetype,
        tamanhoBytes: arquivo.size,
        chaveStorage: chaveR2,
        conteudo: null,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'TRATAMENTO_PONTO_EVIDENCIA_ANEXADA',
      entidade: 'TratamentoPontoEvidencia',
      entidadeId: evidencia.id,
      detalhes: {
        tratamentoId,
        nomeArquivo: arquivo.originalname,
        tamanhoBytes: arquivo.size,
      },
    });

    return {
      id: evidencia.id,
      nomeArquivo: evidencia.nomeArquivo,
      contentType: evidencia.contentType,
      tamanhoBytes: evidencia.tamanhoBytes,
    };
  }

  /**
   * Remove uma evidência: exclui do R2 (se tiver `chaveStorage` , uma
   * evidência antiga, de antes desta rodada, pode só ter `conteudo` no
   * Postgres) E a linha do Postgres, sempre os dois juntos , nunca fica
   * um "órfão" de um lado.
   */
  async removerEvidencia(
    evidenciaId: string,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    const evidencia = await this.verificarEvidenciaNoGrupo(
      evidenciaId,
      grupoIdSolicitante,
    );
    // Pedido do usuário: nada pode ser excluído de um motorista
    // inativo/excluído tampouco , só consulta ao histórico.
    const tratamentoPai = await this.prisma.tratamentoPonto.findUnique({
      where: { id: evidencia.tratamentoId },
      select: { motoristaId: true },
    });
    if (tratamentoPai) {
      await this.tenant.verificarMotoristaAtivo(tratamentoPai.motoristaId);
    }

    if (evidencia.chaveStorage) {
      await this.storage.excluirObjeto(evidencia.chaveStorage);
    }
    await this.prisma.tratamentoPontoEvidencia.delete({
      where: { id: evidenciaId },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'TRATAMENTO_PONTO_EVIDENCIA_REMOVIDA',
      entidade: 'TratamentoPontoEvidencia',
      entidadeId: evidenciaId,
      detalhes: {
        tratamentoId: evidencia.tratamentoId,
        nomeArquivo: evidencia.nomeArquivo,
      },
    });
  }

  /** Baixa os bytes de uma evidência (do R2 ou do Postgres) para o gestor ou o próprio motorista conferirem. */
  async baixarEvidencia(evidenciaId: string) {
    const evidencia = await this.prisma.tratamentoPontoEvidencia.findUnique({
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

  /** Tenant check auxiliar reaproveitado pelos controllers (evidência é dependura de um tratamento, não tem motoristaId direto). */
  async verificarTratamentoNoGrupo(
    tratamentoId: string,
    grupoIdSolicitante: string,
  ) {
    const tratamento = await this.prisma.tratamentoPonto.findUnique({
      where: { id: tratamentoId },
    });
    if (!tratamento) throw new NotFoundException('Tratamento não encontrado');
    await this.tenant.verificarMotoristaNoGrupo(
      tratamento.motoristaId,
      grupoIdSolicitante,
    );
    return tratamento;
  }

  /** Tenant check auxiliar pra rotas de download de evidência (via tratamento pai). */
  async verificarEvidenciaNoGrupo(
    evidenciaId: string,
    grupoIdSolicitante: string,
  ) {
    const evidencia = await this.prisma.tratamentoPontoEvidencia.findUnique({
      where: { id: evidenciaId },
    });
    if (!evidencia) throw new NotFoundException('Evidência não encontrada');
    await this.verificarTratamentoNoGrupo(
      evidencia.tratamentoId,
      grupoIdSolicitante,
    );
    return evidencia;
  }

  // ===== App do motorista (dispositivo/meus-ajustes) =====

  /**
   * O motorista só vê os próprios ajustes , identidade já garantida pelo
   * MotoristaDeviceGuard. Rodada 79 (pedido do usuário): exclui daqui os
   * TratamentoPonto que nasceram de uma SolicitacaoAjustePonto do próprio
   * motorista aprovada pelo RH (`solicitacaoOrigem` preenchido) , esses já
   * aparecem em "Minhas solicitações" com status "Aprovado", então
   * mostrá-los também aqui era o mesmo ajuste duplicado na lista. O que
   * sobra aqui ("Ajustes lançados pela empresa") é só o que o RH lançou
   * direto, sem pedido do motorista.
   */
  async listarMeusAjustes(motoristaId: string) {
    return this.prisma.tratamentoPonto.findMany({
      where: { motoristaId, solicitacaoOrigem: null },
      orderBy: { timestampEvento: 'desc' },
      include: {
        usuario: { select: { nome: true } },
        evidencias: {
          select: {
            id: true,
            nomeArquivo: true,
            contentType: true,
            tamanhoBytes: true,
          },
        },
      },
    });
  }

  /** Download de evidência pelo próprio motorista , só se o tratamento for dele. */
  async baixarEvidenciaDoMotorista(evidenciaId: string, motoristaId: string) {
    const evidencia = await this.prisma.tratamentoPontoEvidencia.findUnique({
      where: { id: evidenciaId },
    });
    if (!evidencia) throw new NotFoundException('Evidência não encontrada');
    const tratamento = await this.prisma.tratamentoPonto.findUnique({
      where: { id: evidencia.tratamentoId },
    });
    if (!tratamento || tratamento.motoristaId !== motoristaId) {
      throw new NotFoundException('Evidência não encontrada'); // não vaza que existe pra outro motorista
    }
    return this.baixarEvidencia(evidenciaId);
  }

  /** Marca que o motorista deu ciência do ajuste (leu no app) , nunca obrigatório, só registra o histórico. */
  async darCiencia(tratamentoId: string, motoristaId: string) {
    const tratamento = await this.prisma.tratamentoPonto.findUnique({
      where: { id: tratamentoId },
    });
    if (!tratamento) throw new NotFoundException('Tratamento não encontrado');
    if (tratamento.motoristaId !== motoristaId) {
      throw new NotFoundException('Tratamento não encontrado'); // não vaza que existe pra outro motorista
    }
    if (tratamento.motoristaCienciaEm) return tratamento; // idempotente
    return this.prisma.tratamentoPonto.update({
      where: { id: tratamentoId },
      data: { motoristaCienciaEm: new Date() },
    });
  }
}
