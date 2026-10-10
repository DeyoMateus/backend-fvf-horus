import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType, Prisma } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { WhatsappNotificationsService } from '../common/notifications/whatsapp-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateAutorrelatoFolgaDto } from './dto/create-autorrelato-folga.dto';
import { TratarDiaSemInteracaoDto } from './dto/tratar-dia-sem-interacao.dto';
import {
  chaveDiaBrt,
  offsetPadraoDaEmpresa,
  paraParedeBrt,
} from '../common/fuso/fuso-brasil.util';

function paraDiaUtc(data: string | Date): Date {
  const d = typeof data === 'string' ? new Date(data) : data;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function chaveDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class AutorrelatoFolgaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
    private readonly whatsapp: WhatsappNotificationsService,
  ) {}

  /**
   * Chamado pelo próprio app do motorista (MotoristaDeviceGuard). Não é
   * ponto , não entra no ledger/hash chain, é só um aviso pro gestor não
   * estranhar a ausência de registros naquele dia. `upsert` porque
   * reenviar o mesmo dia (ex.: reabrir o app offline e mandar de novo)
   * deve só atualizar a observação, nunca duplicar.
   */
  async autorrelatar(motoristaId: string, dto: CreateAutorrelatoFolgaDto) {
    const dia = paraDiaUtc(dto.data);
    const registro = await this.prisma.autorrelatoFolga.upsert({
      where: { motoristaId_data: { motoristaId, data: dia } },
      create: { motoristaId, data: dia, observacao: dto.observacao },
      update: { observacao: dto.observacao },
    });

    await this.audit.registrar({
      actorType: ActorType.MOTORISTA,
      actorId: motoristaId,
      acao: 'AUTORRELATO_FOLGA',
      entidade: 'AutorrelatoFolga',
      entidadeId: registro.id,
      detalhes: { data: chaveDia(dia) },
    });

    return registro;
  }

  async listarPorMotorista(motoristaId: string, grupoIdSolicitante: string) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );

    return this.prisma.autorrelatoFolga.findMany({
      where: { motoristaId },
      orderBy: { data: 'desc' },
      take: 60,
    });
  }

  /**
   * Rodada 57 , pedido do usuário: o próprio motorista precisa
   * conseguir conferir, no app, os avisos de folga que ele mandou
   * ("meus pedidos"). Sem checagem de tenant de propósito , a
   * identidade já vem garantida pelo `MotoristaDeviceGuard`
   * (`req.motorista.id`), então o motorista só pode listar as
   * próprias folgas, nunca de outro (mesmo padrão de
   * `AlertasJornadaMobileController.listarMeusAlertas`).
   */
  async listarMinhas(motoristaId: string) {
    return this.prisma.autorrelatoFolga.findMany({
      where: { motoristaId },
      orderBy: { data: 'desc' },
      take: 60,
    });
  }

  /**
   * Rodada 57 , pedido do usuário: se o motorista tenta bater ponto num
   * dia que ele mesmo avisou como folga, o app pergunta se ele quer
   * continuar mesmo assim; se sim, a folga precisa ser anulada no
   * sistema (senão o dia continuaria contando como folga pro gestor,
   * incoerente com o ponto que acabou de ser batido).
   *
   * `AutorrelatoFolga` não é WORM (não é ponto, não entra no
   * ledger/hash chain , ver comentário em `autorrelatar` acima), então
   * anular aqui é apagar o registro mesmo, sem precisar de coluna de
   * status: o rastro de auditoria (quem, quando, por quê) fica
   * garantido pelo `AuditService`, não pela linha em si.
   *
   * Idempotente: se já não existir (ex.: o motorista tocou "continuar"
   * duas vezes, ou já tinha anulado antes), não é erro , só não faz
   * nada.
   */
  async anular(motoristaId: string, dataStr: string) {
    const dia = paraDiaUtc(dataStr);
    const existente = await this.prisma.autorrelatoFolga.findUnique({
      where: { motoristaId_data: { motoristaId, data: dia } },
    });
    if (!existente) return { anulada: false };

    await this.prisma.autorrelatoFolga.delete({ where: { id: existente.id } });

    await this.audit.registrar({
      actorType: ActorType.MOTORISTA,
      actorId: motoristaId,
      acao: 'AUTORRELATO_FOLGA_ANULADA',
      entidade: 'AutorrelatoFolga',
      entidadeId: existente.id,
      detalhes: {
        data: chaveDia(dia),
        motivo: 'Motorista bateu ponto no dia avisado como folga',
      },
    });

    // Rodada 58 , pedido do usuário: o gestor precisa ser avisado
    // quando uma folga é anulada (não só ficar registrado no painel
    // pra alguém abrir e reparar depois). Mesmo canal já usado pros
    // alertas críticos de jornada (`WhatsappNotificationsService`) ,
    // fail-open: sem WHATSAPP_TOKEN configurado, não faz nada.
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      select: { nome: true, empresaId: true },
    });
    if (motorista) {
      const diaFormatado = chaveDia(dia);
      void this.whatsapp.notificarGestoresDaEmpresa(
        motorista.empresaId,
        `${motorista.nome} bateu ponto em ${diaFormatado.split('-').reverse().join('/')}, dia que tinha avisado como folga , a folga foi anulada automaticamente.`,
      );
    }

    return { anulada: true };
  }

  /**
   * "Dia sem interação": um dia calendário, dentro da janela pedida, em
   * que o motorista não tem NENHUM RegistroJornada e também não
   * autorrelatou folga. Não avalia o dia de hoje (ainda não terminou) ,
   * a janela vai até ontem.
   */
  async diasSemInteracao(grupoId: string, dias = 7) {
    // Rodada 144: "hoje" é o dia civil de Brasília.
    const hojeUtc = paraDiaUtc(paraParedeBrt(new Date()));
    const inicioUtc = new Date(hojeUtc);
    inicioUtc.setUTCDate(
      inicioUtc.getUTCDate() - Math.min(Math.max(dias, 1), 90),
    );

    const motoristas = await this.prisma.motorista.findMany({
      where: { empresa: { grupoId }, status: 'ATIVO' },
      select: {
        id: true,
        nome: true,
        createdAt: true,
        empresa: { select: { fusoHorario: true } },
      },
    });
    if (motoristas.length === 0) return [];
    const offsetEmpresaDe = new Map(
      motoristas.map((m) => [
        m.id,
        offsetPadraoDaEmpresa(m.empresa?.fusoHorario),
      ]),
    );

    const [
      registros,
      autorrelatos,
      folgasConcedidas,
      tratamentosDePonto,
      diasTratados,
    ] = await Promise.all([
      this.prisma.registroJornada.findMany({
        where: {
          motorista: { empresa: { grupoId } },
          // Rodada 147: faixa cobre todos os fusos do Brasil; o corte
          // exato do dia é pelo fuso de cada ponto (fusoOffsetMin).
          timestampEvento: {
            gte: new Date(inicioUtc.getTime() + 2 * 3_600_000),
            lt: new Date(hojeUtc.getTime() + 5 * 3_600_000),
          },
        },
        select: {
          motoristaId: true,
          timestampEvento: true,
          fusoOffsetMin: true,
        },
      }),
      this.prisma.autorrelatoFolga.findMany({
        where: {
          motoristaId: { in: motoristas.map((m) => m.id) },
          data: { gte: inicioUtc, lt: hojeUtc },
        },
        select: { motoristaId: true, data: true },
      }),
      // Folga concedida pelo RH (FolgaConcedidaService) também explica a
      // ausência de ponto no dia , mesmo critério do autorrelato, só que
      // decidido pela empresa em vez do motorista.
      this.prisma.folgaConcedida.findMany({
        where: {
          motoristaId: { in: motoristas.map((m) => m.id) },
          data: { gte: inicioUtc, lt: hojeUtc },
        },
        select: { motoristaId: true, data: true },
      }),
      // Rodada 193: ponto lançado pelo gestor (tratamento de ponto,
      // inclusive "jornada inteira") também preenche o dia , é assim que
      // o dia de "sem sinal/esquecimento" sai do radar.
      this.prisma.tratamentoPonto.findMany({
        where: {
          motoristaId: { in: motoristas.map((m) => m.id) },
          timestampEvento: {
            gte: new Date(inicioUtc.getTime() + 2 * 3_600_000),
            lt: new Date(hojeUtc.getTime() + 5 * 3_600_000),
          },
        },
        select: {
          motoristaId: true,
          timestampEvento: true,
          fusoOffsetMin: true,
        },
      }),
      // Rodada 193: dia tratado pelo gestor (folga, falta, atestado, outro).
      this.prisma.diaSemInteracaoTratado.findMany({
        where: {
          motoristaId: { in: motoristas.map((m) => m.id) },
          data: { gte: inicioUtc, lt: hojeUtc },
        },
        select: { motoristaId: true, data: true },
      }),
    ]);

    const diasComRegistro = new Map<string, Set<string>>();
    for (const r of registros) {
      const set = diasComRegistro.get(r.motoristaId) ?? new Set<string>();
      set.add(
        chaveDiaBrt(
          r.timestampEvento,
          r.fusoOffsetMin ?? offsetEmpresaDe.get(r.motoristaId),
        ),
      );
      diasComRegistro.set(r.motoristaId, set);
    }
    for (const t of tratamentosDePonto) {
      const set = diasComRegistro.get(t.motoristaId) ?? new Set<string>();
      set.add(
        chaveDiaBrt(
          t.timestampEvento,
          t.fusoOffsetMin ?? offsetEmpresaDe.get(t.motoristaId),
        ),
      );
      diasComRegistro.set(t.motoristaId, set);
    }
    const diasComFolga = new Map<string, Set<string>>();
    for (const a of autorrelatos) {
      const set = diasComFolga.get(a.motoristaId) ?? new Set<string>();
      set.add(chaveDia(a.data));
      diasComFolga.set(a.motoristaId, set);
    }
    for (const f of folgasConcedidas) {
      const set = diasComFolga.get(f.motoristaId) ?? new Set<string>();
      set.add(chaveDia(f.data));
      diasComFolga.set(f.motoristaId, set);
    }

    for (const d of diasTratados) {
      const set = diasComFolga.get(d.motoristaId) ?? new Set<string>();
      set.add(chaveDia(d.data));
      diasComFolga.set(d.motoristaId, set);
    }

    const resultado: {
      motoristaId: string;
      nome: string;
      diasSemInteracao: string[];
    }[] = [];
    for (const motorista of motoristas) {
      // Rodada 178: o radar só vale a partir do DIA SEGUINTE ao cadastro
      // (no dia do cadastro o motorista ainda nem tinha o app/vínculo).
      const diaSeguinteAoCadastro =
        paraDiaUtc(paraParedeBrt(motorista.createdAt)).getTime() + 86_400_000;
      const inicioMotorista = new Date(
        Math.max(inicioUtc.getTime(), diaSeguinteAoCadastro),
      );
      const diasFaltando: string[] = [];
      for (
        const cursor = new Date(inicioMotorista);
        cursor.getTime() < hojeUtc.getTime();
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      ) {
        const chave = chaveDia(cursor);
        const temRegistro =
          diasComRegistro.get(motorista.id)?.has(chave) ?? false;
        const temFolga = diasComFolga.get(motorista.id)?.has(chave) ?? false;
        if (!temRegistro && !temFolga) diasFaltando.push(chave);
      }
      if (diasFaltando.length > 0) {
        resultado.push({
          motoristaId: motorista.id,
          nome: motorista.nome,
          diasSemInteracao: diasFaltando,
        });
      }
    }
    return resultado;
  }

  /**
   * Rodada 193: o gestor apura um dia do radar e registra o que foi
   * (folga, falta, atestado ou outro). Só tira o dia do radar e deixa
   * rastro (quem, quando, o quê); NUNCA altera um RegistroJornada. Para
   * FOLGA também grava a folga concedida (mesmo efeito de conceder a
   * folga pela tela do RH). "Sem sinal/esquecimento" não passa por aqui:
   * o painel leva ao tratamento de ponto e o dia sai do radar quando o
   * ponto é lançado.
   */
  async tratarDiaSemInteracao(
    motoristaId: string,
    dto: TratarDiaSemInteracaoDto,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );
    await this.tenant.verificarMotoristaAtivo(motoristaId);

    const dia = paraDiaUtc(dto.data);
    const hojeUtc = paraDiaUtc(paraParedeBrt(new Date()));
    if (dia.getTime() >= hojeUtc.getTime()) {
      throw new BadRequestException(
        'Só é possível tratar dias que já terminaram (até ontem).',
      );
    }

    let tratado;
    try {
      tratado = await this.prisma.diaSemInteracaoTratado.create({
        data: {
          motoristaId,
          data: dia,
          tipo: dto.tipo,
          observacao: dto.observacao,
          tratadoPorUsuarioId: usuarioId,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Este dia já foi tratado para este motorista.');
      }
      throw err;
    }

    if (dto.tipo === 'FOLGA') {
      try {
        await this.prisma.folgaConcedida.create({
          data: {
            motoristaId,
            data: dia,
            motivo: `Tratado no radar de dias sem interação: ${dto.observacao}`.slice(
              0,
              400,
            ),
            concedidaPorUsuarioId: usuarioId,
          },
        });
      } catch (err) {
        // Já existia folga concedida nesse dia: nada a fazer.
        if (
          !(
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          )
        ) {
          throw err;
        }
      }
    }

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'DIA_SEM_INTERACAO_TRATADO',
      entidade: 'DiaSemInteracaoTratado',
      entidadeId: tratado.id,
      detalhes: {
        motoristaId,
        data: chaveDia(dia),
        tipo: dto.tipo,
        observacao: dto.observacao,
      },
    });

    return tratado;
  }
}
