import { Injectable } from '@nestjs/common';
import { ActorType, TipoAjusteBancoHoras } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { HoleriteService } from '../holerite/holerite.service';

/**
 * Banco de horas (Rodada 37) , pedido explícito do usuário: quando a
 * empresa ativa o banco de horas (toggle em RegraSindical, configurado
 * na tela de Regras Sindicais), a hora extra apurada passa a ser
 * tratada como CRÉDITO no banco do motorista, a ser compensada em
 * folga ou paga, "de acordo com a lei ou o sindicato" , o sistema não
 * decide automaticamente qual das duas: o gestor é quem registra o
 * ajuste (débito) quando a compensação/pagamento de fato acontece.
 *
 * Saldo = crédito (hora extra apurada no período, via HoleriteService
 * , nunca duplica esse cálculo) + créditos manuais de correção -
 * débitos (compensação/pagamento/correção), tudo dentro do MESMO
 * período consultado. Não é um saldo perpétuo desde a admissão do
 * motorista , é um saldo do período que o gestor escolher no painel
 * de Indicadores, mesmo espírito de simplicidade do resto do projeto
 * (documentado como limitação de propósito).
 */
export interface SaldoBancoHoras {
  ativo: boolean;
  creditoExtraMin: number;
  creditoCorrecaoMin: number;
  debitoMin: number;
  saldoMin: number;
}

const TIPOS_DEBITO: TipoAjusteBancoHoras[] = [
  TipoAjusteBancoHoras.COMPENSACAO,
  TipoAjusteBancoHoras.PAGAMENTO,
  TipoAjusteBancoHoras.CORRECAO_DEBITO,
];

@Injectable()
export class BancoHorasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly holerite: HoleriteService,
    private readonly audit: AuditService,
  ) {}

  /** Se a convenção coletiva vinculada ao CNPJ do motorista tem o banco de horas ativado. Sem convenção vinculada = nunca ativo (padrão CLT direto, sem banco). */
  async estaAtivoParaMotorista(motoristaId: string): Promise<boolean> {
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      select: {
        empresa: {
          select: { regraSindical: { select: { bancoHorasAtivo: true } } },
        },
      },
    });
    return motorista?.empresa.regraSindical?.bancoHorasAtivo ?? false;
  }

  /**
   * Só os ajustes manuais (créditos de correção e débitos) do período ,
   * NUNCA chama o HoleriteService aqui, pra quem já tem o resultado do
   * holerite em mãos (como o IndicadoresService, que já calcula uma vez
   * por motorista com todas as categorias) não precisar recalcular a
   * mesma coisa de novo. `calcularSaldo` abaixo é quem junta isso com o
   * crédito de hora extra, para quem só quer o saldo pronto (endpoint
   * dedicado de banco de horas).
   */
  async ajustesDoPeriodo(
    motoristaId: string,
    dataInicio: Date,
    dataFim: Date,
  ): Promise<{
    creditoCorrecaoMin: number;
    debitoMin: number;
    ajustes: Array<{ data: Date; tipo: TipoAjusteBancoHoras; minutos: number }>;
  }> {
    const ajustes = await this.prisma.ajusteBancoHoras.findMany({
      where: { motoristaId, data: { gte: dataInicio, lte: dataFim } },
      select: { data: true, tipo: true, minutos: true },
    });
    let creditoCorrecaoMin = 0;
    let debitoMin = 0;
    for (const a of ajustes) {
      if (a.tipo === TipoAjusteBancoHoras.CORRECAO_CREDITO)
        creditoCorrecaoMin += a.minutos;
      else if (TIPOS_DEBITO.includes(a.tipo)) debitoMin += a.minutos;
    }
    return { creditoCorrecaoMin, debitoMin, ajustes };
  }

  async calcularSaldo(
    motoristaId: string,
    dataInicio: Date,
    dataFim: Date,
    grupoIdSolicitante: string,
  ): Promise<SaldoBancoHoras> {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );

    const [ativo, resultadoHolerite, { creditoCorrecaoMin, debitoMin }] =
      await Promise.all([
        this.estaAtivoParaMotorista(motoristaId),
        this.holerite.calcular(
          motoristaId,
          dataInicio,
          dataFim,
          { direcaoEspera: true, normalExtra: true, adicionalNoturno: false },
          grupoIdSolicitante,
        ),
        this.ajustesDoPeriodo(motoristaId, dataInicio, dataFim),
      ]);

    const creditoExtraMin = resultadoHolerite.totais.extraMin;

    return {
      ativo,
      creditoExtraMin,
      creditoCorrecaoMin,
      debitoMin,
      saldoMin: creditoExtraMin + creditoCorrecaoMin - debitoMin,
    };
  }

  async listarAjustes(motoristaId: string, grupoIdSolicitante: string) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );
    return this.prisma.ajusteBancoHoras.findMany({
      where: { motoristaId },
      include: {
        registradoPorUsuario: { select: { nome: true, email: true } },
      },
      orderBy: { data: 'desc' },
    });
  }

  async registrarAjuste(
    motoristaId: string,
    grupoIdSolicitante: string,
    usuarioId: string,
    dados: {
      tipo: TipoAjusteBancoHoras;
      minutos: number;
      data: Date;
      observacao?: string;
    },
  ) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );
    // Pedido do usuário: motorista inativo/excluído não pode receber
    // NENHUM lançamento novo , só consulta ao que já existe.
    await this.tenant.verificarMotoristaAtivo(motoristaId);

    const ajuste = await this.prisma.ajusteBancoHoras.create({
      data: {
        motoristaId,
        tipo: dados.tipo,
        minutos: dados.minutos,
        data: dados.data,
        observacao: dados.observacao,
        registradoPorUsuarioId: usuarioId,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'BANCO_HORAS_AJUSTE_REGISTRADO',
      entidade: 'AjusteBancoHoras',
      entidadeId: ajuste.id,
      detalhes: { motoristaId, tipo: dados.tipo, minutos: dados.minutos },
    });

    return ajuste;
  }
}
