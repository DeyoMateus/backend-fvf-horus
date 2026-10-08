import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';

// Rodada 64 , alertas de "estouro de jornada" (o motor de limites
// legais: direção contínua, jornada de direção, espera) carregam a
// janela de tempo a que se referem (`janelaInicio`/`janelaFim`). Se o
// motorista esquece de bater "Fim de jornada" e o app fica aberto (ou
// a varredura proativa do backend roda) por horas, um alerta real pode
// ficar "não visualizado" até o motorista reabrir o app , só que, se
// nesse meio-tempo ele já deu um NOVO "Início de jornada", esse alerta
// antigo não descreve mais a situação atual: é a jornada de ONTEM
// aparecendo hoje, dando a impressão de que a direção de ontem
// "somou" com a de hoje. O cálculo em si sempre esteve certo (o alerta
// é fiel ao momento em que foi gerado) , o problema é mostrar, como se
// fosse "agora", um aviso de uma jornada que o próprio motorista já
// encerrou ao começar outra.
const TIPOS_ESTOURO_JORNADA_CORRENTE = new Set<string>([
  'DIRECAO_CONTINUA_PROXIMA_LIMITE',
  'DIRECAO_CONTINUA_EXCEDIDA',
  'DIRECAO_RETOMADA_SEM_PAUSA',
  'JORNADA_DIRECAO_PROXIMA_LIMITE',
  'JORNADA_DIRECAO_EXCEDIDA',
  'ESPERA_PROXIMA_LIMITE',
  'ESPERA_LIMITE_LEGAL_ATINGIDO',
]);

@Injectable()
export class AlertasJornadaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
  ) {}

  /**
   * `grupoIdSolicitante` é opcional: quando vem do painel (JWT), é
   * sempre conferido contra o grupo. Quando vem do próprio app do
   * motorista (device binding), o chamador não passa nada , a
   * identidade já foi garantida pelo MotoristaDeviceGuard, então não
   * há tenant nenhum a conferir (o motorista SEMPRE pode ver os
   * próprios alertas).
   *
   * Rodada 64: só quando quem pergunta é o PRÓPRIO app do motorista
   * (`grupoIdSolicitante` ausente), filtra fora os alertas de estouro
   * de jornada cuja janela já ficou pra trás de um "Início de jornada"
   * mais recente , ver comentário de `TIPOS_ESTOURO_JORNADA_CORRENTE`
   * acima. O painel do gestor (`listByGrupo`, sempre com grupo) nunca
   * filtra nada: o histórico completo, inclusive jornadas esquecidas
   * em aberto, continua 100% visível e auditável ali.
   */
  async listByMotorista(
    motoristaId: string,
    grupoIdSolicitante?: string,
    apenasNaoVisualizados = false,
  ) {
    if (grupoIdSolicitante) {
      await this.tenant.verificarMotoristaNoGrupo(
        motoristaId,
        grupoIdSolicitante,
      );
    }
    const alertas = await this.prisma.alertaJornada.findMany({
      where: {
        motoristaId,
        ...(apenasNaoVisualizados ? { visualizadoEm: null } : {}),
        // Rodada 165: violação de integridade é assunto do gestor/GR; o
        // motorista (visão sem grupo solicitante) nunca recebe esse alerta.
        ...(grupoIdSolicitante
          ? {}
          : { tipo: { not: 'INTEGRIDADE_CADEIA_VIOLADA' as const } }),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (grupoIdSolicitante) return alertas;

    const ultimoInicioJornada = await this.prisma.registroJornada.findFirst({
      where: { motoristaId, tipoEvento: 'INICIO_JORNADA' },
      orderBy: { timestampEvento: 'desc' },
      select: { timestampEvento: true },
    });
    if (!ultimoInicioJornada) return alertas;

    return alertas.filter(
      (a) =>
        !TIPOS_ESTOURO_JORNADA_CORRENTE.has(a.tipo) ||
        a.janelaFim >= ultimoInicioJornada.timestampEvento,
    );
  }

  /**
   * Painel do grupo: alertas críticos recentes de todos os motoristas
   * de TODAS as empresas (CNPJs) do grupo, para o "radar" de risco.
   * `grupoId` NUNCA vem de um parâmetro de rota , sempre do token JWT
   * de quem está pedindo, senão qualquer usuário autenticado poderia
   * ler o radar de outro grupo só trocando o id na URL.
   */
  listByGrupo(grupoId: string, apenasNaoVisualizados = false) {
    return this.prisma.alertaJornada.findMany({
      where: {
        motorista: { empresa: { grupoId } },
        ...(apenasNaoVisualizados ? { visualizadoEm: null } : {}),
      },
      include: { motorista: { select: { id: true, nome: true, cpf: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async marcarVisualizado(
    alertaId: string,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    const alerta = await this.prisma.alertaJornada.findUnique({
      where: { id: alertaId },
      include: {
        motorista: { select: { empresa: { select: { grupoId: true } } } },
      },
    });
    if (!alerta) throw new NotFoundException('Alerta não encontrado');
    if (alerta.motorista.empresa.grupoId !== grupoIdSolicitante) {
      throw new ForbiddenException('Alerta não pertence ao seu grupo');
    }

    const atualizado = await this.prisma.alertaJornada.update({
      where: { id: alertaId },
      data: { visualizadoEm: new Date(), visualizadoPorUsuarioId: usuarioId },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'ALERTA_JORNADA_VISUALIZADO',
      entidade: 'AlertaJornada',
      entidadeId: alertaId,
    });

    return atualizado;
  }

  /**
   * Rodada 126, pedido do usuário: o motorista também pode dar ciência de
   * que viu o alerta no próprio app (campo distinto de `visualizadoEm`,
   * que é do gestor no painel). Idempotente, e o alerta em si NUNCA é
   * apagado nem escondido por isto , "ela sempre deve permanecer",
   * pedido explícito , é só um carimbo de leitura, igual ao
   * `motoristaCienciaEm` do TratamentoPonto.
   */
  async marcarVisualizadoPeloMotorista(alertaId: string, motoristaId: string) {
    const alerta = await this.prisma.alertaJornada.findUnique({
      where: { id: alertaId },
    });
    if (!alerta) throw new NotFoundException('Alerta não encontrado');
    if (alerta.motoristaId !== motoristaId) {
      throw new NotFoundException('Alerta não encontrado'); // não vaza que existe pra outro motorista
    }
    if (alerta.motoristaVisualizadoEm) return alerta; // idempotente

    return this.prisma.alertaJornada.update({
      where: { id: alertaId },
      data: { motoristaVisualizadoEm: new Date() },
    });
  }

  /**
   * Tratamento (Rodada 25): diferente de "visualizado" (marca como
   * lido, sem registrar decisão nenhuma), tratar exige uma observação
   * de quem apurou o alerta , o que foi de fato encontrado, se o
   * registro estava certo (falso positivo do motor) ou se precisou de
   * um TratamentoPonto à parte pra corrigir algo. Fica anexado
   * permanentemente ao alerta (nunca apaga/altera o alerta em si, nem
   * nenhum RegistroJornada , WORM continua intocado). Marcar como
   * tratado também marca como visualizado automaticamente, se ainda não
   * estava (não faz sentido tratar algo que "ninguém viu ainda").
   */
  async tratar(
    alertaId: string,
    observacao: string,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    const alerta = await this.prisma.alertaJornada.findUnique({
      where: { id: alertaId },
      include: {
        motorista: { select: { empresa: { select: { grupoId: true } } } },
      },
    });
    if (!alerta) throw new NotFoundException('Alerta não encontrado');
    if (alerta.motorista.empresa.grupoId !== grupoIdSolicitante) {
      throw new ForbiddenException('Alerta não pertence ao seu grupo');
    }

    const agora = new Date();
    const atualizado = await this.prisma.alertaJornada.update({
      where: { id: alertaId },
      data: {
        tratadoEm: agora,
        tratadoPorUsuarioId: usuarioId,
        tratamentoObservacao: observacao,
        visualizadoEm: alerta.visualizadoEm ?? agora,
        visualizadoPorUsuarioId: alerta.visualizadoPorUsuarioId ?? usuarioId,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'ALERTA_JORNADA_TRATADO',
      entidade: 'AlertaJornada',
      entidadeId: alertaId,
      detalhes: { observacao },
    });

    return atualizado;
  }
}
