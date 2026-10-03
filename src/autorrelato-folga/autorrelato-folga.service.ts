import { Injectable, NotFoundException } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { WhatsappNotificationsService } from '../common/notifications/whatsapp-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateAutorrelatoFolgaDto } from './dto/create-autorrelato-folga.dto';

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
    const hojeUtc = paraDiaUtc(new Date());
    const inicioUtc = new Date(hojeUtc);
    inicioUtc.setUTCDate(
      inicioUtc.getUTCDate() - Math.min(Math.max(dias, 1), 90),
    );

    const motoristas = await this.prisma.motorista.findMany({
      where: { empresa: { grupoId }, status: 'ATIVO' },
      select: { id: true, nome: true, createdAt: true },
    });
    if (motoristas.length === 0) return [];

    const [registros, autorrelatos, folgasConcedidas] = await Promise.all([
      this.prisma.registroJornada.findMany({
        where: {
          motorista: { empresa: { grupoId } },
          timestampEvento: { gte: inicioUtc, lt: hojeUtc },
        },
        select: { motoristaId: true, timestampEvento: true },
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
    ]);

    const diasComRegistro = new Map<string, Set<string>>();
    for (const r of registros) {
      const set = diasComRegistro.get(r.motoristaId) ?? new Set<string>();
      set.add(chaveDia(r.timestampEvento));
      diasComRegistro.set(r.motoristaId, set);
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

    const resultado: {
      motoristaId: string;
      nome: string;
      diasSemInteracao: string[];
    }[] = [];
    for (const motorista of motoristas) {
      const inicioMotorista = new Date(
        Math.max(
          inicioUtc.getTime(),
          paraDiaUtc(motorista.createdAt).getTime(),
        ),
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
}
