import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType, StatusSolicitacaoFolga } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import {
  chaveDiaBrt,
  offsetPadraoDaEmpresa,
} from '../common/fuso/fuso-brasil.util';
import { nomeAbreviado } from '../common/notifications/minimizar-dados-whatsapp.util';
import { PushNotificationsService } from '../common/notifications/push-notifications.service';
import { WhatsappNotificationsService } from '../common/notifications/whatsapp-notifications.service';
import { normalizarPaginacao } from '../common/pagination/pagination.util';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { FolgaConcedidaService } from '../folga-concedida/folga-concedida.service';
import { CreateSolicitacaoFolgaDto } from './dto/create-solicitacao-folga.dto';

export const MAXIMO_DIAS_POR_PEDIDO = 15;
const DIA_MS = 86_400_000;

const INCLUDE_PADRAO = {
  decididoPorUsuario: { select: { id: true, nome: true } },
} as const;

function paraDiaUtc(dia: string): Date {
  const [a, m, d] = dia.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  // Rejeita datas impossíveis (ex.: 2026-02-31, que o JS "corrige" sozinho).
  if (
    data.getUTCFullYear() !== a ||
    data.getUTCMonth() !== m - 1 ||
    data.getUTCDate() !== d
  ) {
    throw new BadRequestException(`Data inválida: ${dia}`);
  }
  return data;
}

function formatarDia(d: Date): string {
  return d.toISOString().slice(0, 10).split('-').reverse().join('/');
}

function descreverPeriodo(inicio: Date, fim: Date): string {
  return inicio.getTime() === fim.getTime()
    ? formatarDia(inicio)
    : `${formatarDia(inicio)} a ${formatarDia(fim)}`;
}

/**
 * Rodada 221 , o motorista PEDE folga (não "avisa" mais): um ou vários
 * dias seguidos, de hoje em diante. O RH aceita ou nega com
 * justificativa. Aprovar cria uma `FolgaConcedida` por dia (mesma regra
 * e mesmo alerta de conflito do lançamento direto do RH); negar só
 * marca o status. Dias passados continuam com o RH (radar "dias sem
 * interação"), e o RH segue podendo lançar folga direto sem pedido.
 */
@Injectable()
export class SolicitacoesFolgaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
    private readonly push: PushNotificationsService,
    private readonly whatsapp: WhatsappNotificationsService,
    private readonly folgaConcedida: FolgaConcedidaService,
  ) {}

  // ===== App do motorista =====

  async criar(motoristaId: string, dto: CreateSolicitacaoFolgaDto) {
    const inicio = paraDiaUtc(dto.dataInicio);
    const fim = paraDiaUtc(dto.dataFim);
    if (fim.getTime() < inicio.getTime()) {
      throw new BadRequestException(
        'O último dia não pode ser antes do primeiro',
      );
    }
    const dias = Math.round((fim.getTime() - inicio.getTime()) / DIA_MS) + 1;
    if (dias > MAXIMO_DIAS_POR_PEDIDO) {
      throw new BadRequestException(
        `Cada pedido pode ter no máximo ${MAXIMO_DIAS_POR_PEDIDO} dias seguidos`,
      );
    }

    await this.tenant.verificarMotoristaAtivo(motoristaId);
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      include: { empresa: { select: { fusoHorario: true } } },
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');

    // "Hoje" no fuso da empresa , o motorista só pede hoje e dias futuros.
    const hoje = chaveDiaBrt(
      new Date(),
      offsetPadraoDaEmpresa(
        (motorista as { empresa?: { fusoHorario?: string } }).empresa
          ?.fusoHorario,
      ),
    );
    if (dto.dataInicio < hoje) {
      throw new BadRequestException(
        'Só é possível pedir folga a partir de hoje. Para dias que já passaram, fale com o RH.',
      );
    }

    // Sem pedido duplicado/sobreposto enquanto houver um pendente.
    const sobreposta = await this.prisma.solicitacaoFolga.findFirst({
      where: {
        motoristaId,
        status: StatusSolicitacaoFolga.PENDENTE,
        dataInicio: { lte: fim },
        dataFim: { gte: inicio },
      },
    });
    if (sobreposta) {
      throw new ConflictException(
        'Você já tem um pedido de folga pendente que cobre algum desses dias',
      );
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
      actorType: ActorType.MOTORISTA,
      actorId: motoristaId,
      acao: 'SOLICITACAO_FOLGA_CRIADA',
      entidade: 'SolicitacaoFolga',
      entidadeId: solicitacao.id,
      detalhes: { dataInicio: dto.dataInicio, dataFim: dto.dataFim, dias },
    });

    // WhatsApp mínimo (só nome abreviado e período , sem observação).
    void this.whatsapp.notificarGestoresDaEmpresa(
      motorista.empresaId,
      `${nomeAbreviado(motorista.nome)} pediu folga de ${descreverPeriodo(inicio, fim)}. Veja no painel.`,
    );

    return solicitacao;
  }

  async listarMinhas(motoristaId: string) {
    return this.prisma.solicitacaoFolga.findMany({
      where: { motoristaId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: INCLUDE_PADRAO,
    });
  }

  // ===== Painel (RH/gestor) =====

  async listarPorMotorista(motoristaId: string, grupoIdSolicitante: string) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );
    return this.prisma.solicitacaoFolga.findMany({
      where: { motoristaId },
      orderBy: { createdAt: 'desc' },
      include: INCLUDE_PADRAO,
    });
  }

  async listarPendentesDoGrupo(grupoIdSolicitante: string) {
    return this.prisma.solicitacaoFolga.findMany({
      where: {
        status: StatusSolicitacaoFolga.PENDENTE,
        motorista: { empresa: { grupoId: grupoIdSolicitante } },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        ...INCLUDE_PADRAO,
        motorista: { select: { id: true, nome: true } },
      },
    });
  }

  async contarPendentesDoGrupo(grupoIdSolicitante: string) {
    const total = await this.prisma.solicitacaoFolga.count({
      where: {
        status: StatusSolicitacaoFolga.PENDENTE,
        motorista: { empresa: { grupoId: grupoIdSolicitante } },
      },
    });
    return { total };
  }

  async listarHistoricoDoGrupo(
    grupoIdSolicitante: string,
    page?: number,
    pageSize?: number,
    ordem?: 'asc' | 'desc',
  ) {
    const paginacao = normalizarPaginacao(page, pageSize);
    const where = {
      status: {
        in: [StatusSolicitacaoFolga.APROVADA, StatusSolicitacaoFolga.NEGADA],
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

    const justificativa = motivoDecisao?.trim();
    const motivoFolga = justificativa
      ? `Folga pedida pelo motorista e aprovada pelo RH: ${justificativa}`
      : 'Folga pedida pelo motorista e aprovada pelo RH';

    // Uma FolgaConcedida por dia. Dia que já tinha folga concedida é
    // pulado (não é erro: o resultado desejado já existe).
    const dias: string[] = [];
    for (
      let t = solicitacao.dataInicio.getTime();
      t <= solicitacao.dataFim.getTime();
      t += DIA_MS
    ) {
      dias.push(new Date(t).toISOString().slice(0, 10));
    }
    let criadas = 0;
    for (const data of dias) {
      try {
        await this.folgaConcedida.conceder(
          solicitacao.motoristaId,
          { data, motivo: motivoFolga },
          usuarioId,
          grupoIdSolicitante,
        );
        criadas++;
      } catch (err) {
        if (!(err instanceof ConflictException)) throw err;
      }
    }

    const atualizada = await this.prisma.solicitacaoFolga.update({
      where: { id: solicitacaoId },
      data: {
        status: StatusSolicitacaoFolga.APROVADA,
        decididoPorUsuarioId: usuarioId,
        decididoEm: new Date(),
        motivoDecisao: justificativa || null,
      },
      include: INCLUDE_PADRAO,
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
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

    await this.push.notificarMotorista(
      solicitacao.motoristaId,
      'Pedido de folga aprovado',
      `Sua folga de ${descreverPeriodo(solicitacao.dataInicio, solicitacao.dataFim)} foi aprovada.${justificativa ? ` Observação do RH: ${justificativa}` : ''}`,
      { tipo: 'SOLICITACAO_FOLGA_APROVADA', solicitacaoId },
    );

    return atualizada;
  }

  async negar(
    solicitacaoId: string,
    motivoDecisao: string,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    if (!motivoDecisao?.trim()) {
      throw new BadRequestException(
        'Informe a justificativa , o motorista precisa entender por que a folga não foi aceita',
      );
    }
    const solicitacao = await this.buscarPendentePertencente(
      solicitacaoId,
      grupoIdSolicitante,
    );
    const justificativa = motivoDecisao.trim();

    const atualizada = await this.prisma.solicitacaoFolga.update({
      where: { id: solicitacaoId },
      data: {
        status: StatusSolicitacaoFolga.NEGADA,
        decididoPorUsuarioId: usuarioId,
        decididoEm: new Date(),
        motivoDecisao: justificativa,
      },
      include: INCLUDE_PADRAO,
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'SOLICITACAO_FOLGA_NEGADA',
      entidade: 'SolicitacaoFolga',
      entidadeId: solicitacaoId,
      detalhes: { motoristaId: solicitacao.motoristaId },
    });

    await this.push.notificarMotorista(
      solicitacao.motoristaId,
      'Pedido de folga não aprovado',
      `Sua folga de ${descreverPeriodo(solicitacao.dataInicio, solicitacao.dataFim)} não foi aprovada. Motivo: ${justificativa}`,
      { tipo: 'SOLICITACAO_FOLGA_NEGADA', solicitacaoId },
    );

    return atualizada;
  }

  private async buscarPendentePertencente(
    solicitacaoId: string,
    grupoIdSolicitante: string,
  ) {
    const solicitacao = await this.prisma.solicitacaoFolga.findUnique({
      where: { id: solicitacaoId },
    });
    if (!solicitacao) throw new NotFoundException('Pedido não encontrado');
    await this.tenant.verificarMotoristaNoGrupo(
      solicitacao.motoristaId,
      grupoIdSolicitante,
    );
    if (solicitacao.status !== StatusSolicitacaoFolga.PENDENTE) {
      throw new BadRequestException('Este pedido já foi decidido');
    }
    await this.tenant.verificarMotoristaAtivo(solicitacao.motoristaId);
    return solicitacao;
  }
}
