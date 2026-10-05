import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  Prisma,
  SeveridadeAlerta,
  TipoAlertaJornada,
} from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { WhatsappNotificationsService } from '../common/notifications/whatsapp-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateFolgaConcedidaDto } from './dto/create-folga-concedida.dto';
import {
  chaveDiaBrt,
  offsetPadraoDaEmpresa,
} from '../common/fuso/fuso-brasil.util';

function paraDiaUtc(data: string | Date): Date {
  const d = typeof data === 'string' ? new Date(data) : data;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function proximoDiaUtc(dia: Date): Date {
  const p = new Date(dia);
  p.setUTCDate(p.getUTCDate() + 1);
  return p;
}

/**
 * Folga concedida pelo RH/gestor , ver o comentário do model
 * `FolgaConcedida` no schema.prisma pro porquê de existir separado de
 * `AutorrelatoFolga`.
 *
 * Regra que NUNCA pode ser quebrada aqui: conceder uma folga jamais
 * apaga ou altera um `RegistroJornada` existente (impossível de
 * qualquer forma , trigger WORM no banco + nenhuma rota de
 * update/delete). Se o dia já tinha ponto batido, a folga entra como
 * um status novo e paralelo, e este serviço levanta um
 * `AlertaJornada` (`PONTO_REGISTRADO_EM_DIA_DE_FOLGA`) pra alguém
 * conferir o conflito manualmente , nunca resolve o conflito sozinho.
 *
 * A direção simétrica (motorista bate ponto num dia que já tinha
 * folga concedida) é tratada em
 * `RegistrosJornadaService.avaliarFolgaConflitante`.
 */
@Injectable()
export class FolgaConcedidaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
    private readonly whatsapp: WhatsappNotificationsService,
  ) {}

  async conceder(
    motoristaId: string,
    dto: CreateFolgaConcedidaDto,
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
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      include: { empresa: { select: { fusoHorario: true } } },
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');
    const offsetEmpresaMin = offsetPadraoDaEmpresa(
      (motorista as { empresa?: { fusoHorario?: string } }).empresa
        ?.fusoHorario,
    );

    const dia = paraDiaUtc(dto.data);
    const inicioProximoDia = proximoDiaUtc(dia);

    let folga;
    try {
      folga = await this.prisma.folgaConcedida.create({
        data: {
          motoristaId,
          data: dia,
          motivo: dto.motivo,
          concedidaPorUsuarioId: usuarioId,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe uma folga concedida para este motorista nesse dia',
        );
      }
      throw err;
    }

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'FOLGA_CONCEDIDA_CRIADA',
      entidade: 'FolgaConcedida',
      entidadeId: folga.id,
      detalhes: { motoristaId, data: dia.toISOString().slice(0, 10) },
    });

    // Não apaga nada , só confere se já existe ponto batido nesse dia
    // pra levantar o alerta de conferência. Ver o comentário da classe.
    // Rodada 147: o dia da folga é o dia civil NO FUSO DO MOTORISTA em cada
    // ponto (fusoOffsetMin do registro; sem ele, fuso da empresa). A busca
    // cobre a faixa de todos os fusos do Brasil e o filtro exato é por dia.
    const diaChave = dia.toISOString().slice(0, 10);
    const candidatos = await this.prisma.registroJornada.findMany({
      where: {
        motoristaId,
        timestampEvento: {
          gte: new Date(dia.getTime() + 2 * 3_600_000),
          lt: new Date(inicioProximoDia.getTime() + 5 * 3_600_000),
        },
      },
      orderBy: { sequencial: 'asc' },
    });
    const registrosDoDia = candidatos.filter(
      (r) =>
        chaveDiaBrt(
          r.timestampEvento,
          (r as { fusoOffsetMin?: number | null }).fusoOffsetMin ??
            offsetEmpresaMin,
        ) === diaChave,
    );

    if (registrosDoDia.length > 0) {
      const diaFormatado = dia.toISOString().slice(0, 10);
      const alerta = await this.prisma.alertaJornada.create({
        data: {
          motoristaId,
          tipo: TipoAlertaJornada.PONTO_REGISTRADO_EM_DIA_DE_FOLGA,
          severidade: SeveridadeAlerta.ATENCAO,
          mensagem: `Folga concedida para ${diaFormatado}, mas já existem ${registrosDoDia.length} registro(s) de ponto nesse dia , confira o conflito.`,
          janelaInicio: new Date(
            dia.getTime() -
              ((registrosDoDia[0] as { fusoOffsetMin?: number | null })
                .fusoOffsetMin ?? offsetEmpresaMin) *
                60_000,
          ),
          janelaFim: new Date(
            inicioProximoDia.getTime() -
              ((registrosDoDia[0] as { fusoOffsetMin?: number | null })
                .fusoOffsetMin ?? offsetEmpresaMin) *
                60_000,
          ),
          minutosAcumulados: 0,
          registroGeradorId: registrosDoDia[0].id,
          detalhes: {
            folgaConcedidaId: folga.id,
            registrosConflitantesIds: registrosDoDia.map((r) => r.id),
          } as Prisma.InputJsonValue,
        },
      });

      await this.audit.registrar({
        actorType: ActorType.SISTEMA,
        acao: 'ALERTA_JORNADA_PONTO_REGISTRADO_EM_DIA_DE_FOLGA',
        entidade: 'AlertaJornada',
        entidadeId: alerta.id,
        detalhes: {
          motoristaId,
          folgaConcedidaId: folga.id,
          registrosConflitantes: registrosDoDia.length,
        },
      });
    }

    return folga;
  }

  async listarPorMotorista(motoristaId: string, grupoIdSolicitante: string) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );
    return this.prisma.folgaConcedida.findMany({
      where: { motoristaId },
      orderBy: { data: 'desc' },
      include: { concedidaPorUsuario: { select: { id: true, nome: true } } },
    });
  }

  /**
   * Rodada 58 , pedido do usuário: o app do motorista precisa
   * conseguir ver as folgas que A EMPRESA concedeu pra ele, pro mesmo
   * comparativo que já existe pra `AutorrelatoFolga` (avisar se ele
   * tentar bater ponto num dia de folga). Sem checagem de tenant de
   * propósito , identidade garantida pelo `MotoristaDeviceGuard`.
   */
  async listarMinhas(motoristaId: string) {
    return this.prisma.folgaConcedida.findMany({
      where: { motoristaId },
      orderBy: { data: 'desc' },
      take: 60,
    });
  }

  /**
   * Rodada 58 , mesmo comportamento pedido pro `AutorrelatoFolga`: se
   * o motorista bate ponto num dia que a empresa concedeu como folga,
   * o app pergunta se ele quer continuar e, se sim, chama isto aqui ,
   * anula a folga concedida (apaga, não é WORM , ver comentário da
   * classe) e AVISA O GESTOR na hora, pelo mesmo canal já usado pros
   * alertas críticos de jornada.
   *
   * Idempotente, igual ao `AutorrelatoFolgaService.anular`.
   */
  async anular(motoristaId: string, dataStr: string) {
    const dia = paraDiaUtc(dataStr);
    const existente = await this.prisma.folgaConcedida.findUnique({
      where: { motoristaId_data: { motoristaId, data: dia } },
    });
    if (!existente) return { anulada: false };

    await this.prisma.folgaConcedida.delete({ where: { id: existente.id } });

    await this.audit.registrar({
      actorType: ActorType.MOTORISTA,
      actorId: motoristaId,
      acao: 'FOLGA_CONCEDIDA_ANULADA',
      entidade: 'FolgaConcedida',
      entidadeId: existente.id,
      detalhes: {
        data: dia.toISOString().slice(0, 10),
        motivo: 'Motorista bateu ponto no dia da folga concedida',
      },
    });

    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      select: { nome: true, empresaId: true },
    });
    if (motorista) {
      const diaFormatado = dia
        .toISOString()
        .slice(0, 10)
        .split('-')
        .reverse()
        .join('/');
      void this.whatsapp.notificarGestoresDaEmpresa(
        motorista.empresaId,
        `${motorista.nome} bateu ponto em ${diaFormatado}, dia em que a empresa tinha concedido folga , a folga foi anulada automaticamente.`,
      );
    }

    return { anulada: true };
  }
}
