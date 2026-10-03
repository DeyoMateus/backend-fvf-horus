import { Injectable } from '@nestjs/common';
import { StatusMotorista, TipoAjusteBancoHoras } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { HoleriteService } from '../holerite/holerite.service';
import { BancoHorasService } from '../banco-horas/banco-horas.service';
import { TIPOS_ALERTA_RISCO_FRAUDE } from '../dashboard/dashboard.service';

/**
 * "Indicadores" , dashboard analítico do gestor (Rodada 36), pensado
 * como um analista de operação pensaria: onde estão as horas, onde
 * está o excesso (hora extra, adicional noturno), onde está a
 * ineficiência (tempo de espera como % da jornada) e onde está o
 * risco (alertas, principalmente os de risco de fraude). Rodada 37
 * acrescentou o banco de horas (quando a CCT do motorista tem o
 * toggle ligado, ver BancoHorasService).
 *
 * Restrição explícita do usuário: SOMENTE horas/contagens, nunca
 * valor em R$ , a empresa decide o que paga e quanto fora da
 * plataforma (RH recebe as horas completas e separadas e decide por
 * fora). Por isso não existe nenhum campo de valor/hora ou salário
 * aqui nem em nenhum lugar do sistema , decisão deliberada, não
 * esquecimento.
 *
 * Reaproveita o mesmo motor de cálculo do holerite (HoleriteService,
 * Rodada 26) por motorista/dia , nunca duplica a lógica de separar
 * direção/espera/normal/extra/noturno, pra nunca divergir do número
 * que aparece no holerite individual de cada motorista.
 *
 * Limitação conhecida, aceitável para o tamanho de frota esperado:
 * calcula 1 motorista por vez (2-3 queries cada, dentro do
 * HoleriteService/BancoHorasService) , para frotas muito grandes
 * (centenas de motoristas) isso pode ficar lento; não foi otimizado
 * para lote nesta rodada porque o volume atual do projeto não
 * justifica a complexidade extra.
 */
export interface IndicadoresAlertas {
  total: number;
  criticos: number;
  atencao: number;
  info: number;
  riscoFraude: number;
}

export interface IndicadoresBancoHoras {
  ativo: boolean;
  creditoExtraMin: number;
  creditoCorrecaoMin: number;
  debitoMin: number;
  saldoMin: number;
}

function bancoHorasVazio(): IndicadoresBancoHoras {
  return {
    ativo: false,
    creditoExtraMin: 0,
    creditoCorrecaoMin: 0,
    debitoMin: 0,
    saldoMin: 0,
  };
}

export interface IndicadoresMotorista {
  motoristaId: string;
  nome: string;
  direcaoMin: number;
  esperaMin: number;
  normalMin: number;
  extraMin: number;
  noturnoMin: number;
  /// Rodada 68 , jornada aberta sem etapa em aberto (nem direção, nem
  /// descanso, nem espera, nem "aguardando documentação"): o motorista
  /// não escolheu a próxima ação. Separado de propósito das demais
  /// categorias , não é tempo trabalhado, é tempo sem status.
  indefinidoMin: number;
  alertas: IndicadoresAlertas;
  // Indicadores derivados , o que ajuda a decidir, não só o dado bruto:
  // % de hora extra sobre a direção (quanto da direção "estourou" o
  // limite normal), % de espera sobre o total trabalhado (ociosidade
  // operacional , tempo parado esperando carga/descarga, um dos
  // maiores vilões de eficiência em transporte), % de adicional
  // noturno sobre a direção (planejamento de rota/janela de entrega),
  // % de tempo indefinido sobre o total da jornada (sinal de que o
  // motorista não está escolhendo a próxima etapa no app).
  percentualExtraSobreDirecao: number;
  percentualEsperaSobreTotal: number;
  percentualNoturnoSobreDirecao: number;
  percentualIndefinidoSobreJornada: number;
  /// null quando a CCT deste motorista não tem banco de horas ligado ,
  /// o card/tabela do frontend decide não mostrar a coluna pra ele.
  bancoHoras: IndicadoresBancoHoras;
}

export interface IndicadoresDiaTendencia {
  dia: string; // YYYY-MM-DD
  direcaoMin: number;
  esperaMin: number;
  normalMin: number;
  extraMin: number;
  noturnoMin: number;
  indefinidoMin: number;
  alertas: number;
  /// Crédito/débito do dia (só dos motoristas com banco de horas
  /// ativo) e o saldo ACUMULADO desde o início do período escolhido ,
  /// não é saldo perpétuo desde a admissão, ver comentário no
  /// BancoHorasService.
  bancoHorasCreditoMin: number;
  bancoHorasDebitoMin: number;
  bancoHorasSaldoAcumuladoMin: number;
}

export interface IndicadoresRankingItem {
  motoristaId: string;
  nome: string;
  valorMin: number;
}

export interface IndicadoresPainel {
  periodoInicio: string;
  periodoFim: string;
  motoristaFiltro: string | null;
  motoristas: IndicadoresMotorista[];
  totais: {
    direcaoMin: number;
    esperaMin: number;
    normalMin: number;
    extraMin: number;
    noturnoMin: number;
    indefinidoMin: number;
    alertas: IndicadoresAlertas;
    percentualExtraSobreDirecao: number;
    percentualEsperaSobreTotal: number;
    percentualNoturnoSobreDirecao: number;
    percentualIndefinidoSobreJornada: number;
    bancoHoras: IndicadoresBancoHoras;
  };
  /// Quantos dos motoristas no escopo têm o banco de horas ligado ,
  /// o frontend só mostra o card/gráfico de banco de horas se > 0.
  motoristasComBancoHorasAtivo: number;
  tendenciaDiaria: IndicadoresDiaTendencia[];
  // Rankings , pensados pra apontar direto onde agir: quem mais gera
  // hora extra (candidato a rebalancear rota/escala) e quem mais fica
  // parado esperando carga/descarga (candidato a revisão de processo
  // do cliente/ponto de carga, não do motorista).
  rankingHorasExtras: IndicadoresRankingItem[];
  rankingTempoEspera: IndicadoresRankingItem[];
  rankingTempoIndefinido: IndicadoresRankingItem[];
}

function pct(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((parte / total) * 1000) / 10; // 1 casa decimal
}

@Injectable()
export class IndicadoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly holerite: HoleriteService,
    private readonly bancoHoras: BancoHorasService,
  ) {}

  async painel(
    grupoId: string,
    dataInicio: Date,
    dataFim: Date,
    motoristaId?: string,
  ): Promise<IndicadoresPainel> {
    if (motoristaId) {
      await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoId);
    }

    const motoristas = await this.prisma.motorista.findMany({
      where: {
        empresa: { grupoId },
        status: StatusMotorista.ATIVO,
        ...(motoristaId ? { id: motoristaId } : {}),
      },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });

    const opcoes = {
      direcaoEspera: true,
      normalExtra: true,
      adicionalNoturno: true,
    };

    const resultados = await Promise.all(
      motoristas.map((m) =>
        this.holerite.calcular(m.id, dataInicio, dataFim, opcoes, grupoId),
      ),
    );

    // Banco de horas: um motorista por vez, mesma filosofia do resto
    // deste service , só busca ativo/ajustes pra quem a CCT tem o
    // toggle ligado (a maioria não vai ter, então isso normalmente é
    // rápido).
    const bancoHorasPorMotorista = await Promise.all(
      motoristas.map(async (m) => {
        const ativo = await this.bancoHoras.estaAtivoParaMotorista(m.id);
        if (!ativo)
          return {
            ajustes: [] as Array<{
              data: Date;
              tipo: TipoAjusteBancoHoras;
              minutos: number;
            }>,
            info: bancoHorasVazio(),
          };
        const { creditoCorrecaoMin, debitoMin, ajustes } =
          await this.bancoHoras.ajustesDoPeriodo(m.id, dataInicio, dataFim);
        return {
          ajustes,
          info: {
            ativo,
            creditoExtraMin: 0,
            creditoCorrecaoMin,
            debitoMin,
            saldoMin: 0,
          },
        };
      }),
    );

    const alertas = await this.prisma.alertaJornada.findMany({
      where: {
        motorista: {
          empresa: { grupoId },
          ...(motoristaId ? { id: motoristaId } : {}),
        },
        createdAt: { gte: dataInicio, lte: dataFim },
      },
      select: {
        motoristaId: true,
        severidade: true,
        tipo: true,
        createdAt: true,
      },
    });

    const alertasVazios = (): IndicadoresAlertas => ({
      total: 0,
      criticos: 0,
      atencao: 0,
      info: 0,
      riscoFraude: 0,
    });
    const alertasPorMotorista = new Map<string, IndicadoresAlertas>();
    const alertasPorDia = new Map<string, number>();
    for (const a of alertas) {
      const bucket = alertasPorMotorista.get(a.motoristaId) ?? alertasVazios();
      bucket.total++;
      if (a.severidade === 'CRITICO') bucket.criticos++;
      else if (a.severidade === 'ATENCAO') bucket.atencao++;
      else bucket.info++;
      if (TIPOS_ALERTA_RISCO_FRAUDE.includes(a.tipo)) bucket.riscoFraude++;
      alertasPorMotorista.set(a.motoristaId, bucket);

      const chaveDia = a.createdAt.toISOString().slice(0, 10);
      alertasPorDia.set(chaveDia, (alertasPorDia.get(chaveDia) ?? 0) + 1);
    }

    const motoristasIndicadores: IndicadoresMotorista[] = resultados.map(
      (r, i) => {
        const m = motoristas[i];
        const totalTrabalhado = r.totais.direcaoMin + r.totais.esperaMin;
        const totalJornadaRastreado = totalTrabalhado + r.totais.indefinidoMin;
        const a = alertasPorMotorista.get(m.id) ?? alertasVazios();
        const bh = bancoHorasPorMotorista[i].info;
        const bancoHorasFinal: IndicadoresBancoHoras = bh.ativo
          ? {
              ...bh,
              creditoExtraMin: r.totais.extraMin,
              saldoMin:
                r.totais.extraMin + bh.creditoCorrecaoMin - bh.debitoMin,
            }
          : bancoHorasVazio();
        return {
          motoristaId: m.id,
          nome: m.nome,
          direcaoMin: r.totais.direcaoMin,
          esperaMin: r.totais.esperaMin,
          normalMin: r.totais.normalMin,
          extraMin: r.totais.extraMin,
          noturnoMin: r.totais.noturnoMin,
          indefinidoMin: r.totais.indefinidoMin,
          alertas: a,
          percentualExtraSobreDirecao: pct(
            r.totais.extraMin,
            r.totais.direcaoMin,
          ),
          percentualEsperaSobreTotal: pct(r.totais.esperaMin, totalTrabalhado),
          percentualNoturnoSobreDirecao: pct(
            r.totais.noturnoMin,
            r.totais.direcaoMin,
          ),
          percentualIndefinidoSobreJornada: pct(
            r.totais.indefinidoMin,
            totalJornadaRastreado,
          ),
          bancoHoras: bancoHorasFinal,
        };
      },
    );

    const totaisAcumulados = motoristasIndicadores.reduce(
      (acc, m) => ({
        direcaoMin: acc.direcaoMin + m.direcaoMin,
        esperaMin: acc.esperaMin + m.esperaMin,
        normalMin: acc.normalMin + m.normalMin,
        extraMin: acc.extraMin + m.extraMin,
        noturnoMin: acc.noturnoMin + m.noturnoMin,
        indefinidoMin: acc.indefinidoMin + m.indefinidoMin,
      }),
      {
        direcaoMin: 0,
        esperaMin: 0,
        normalMin: 0,
        extraMin: 0,
        noturnoMin: 0,
        indefinidoMin: 0,
      },
    );
    const alertasTotais = alertasVazios();
    for (const a of alertasPorMotorista.values()) {
      alertasTotais.total += a.total;
      alertasTotais.criticos += a.criticos;
      alertasTotais.atencao += a.atencao;
      alertasTotais.info += a.info;
      alertasTotais.riscoFraude += a.riscoFraude;
    }

    const motoristasComBancoHorasAtivo = motoristasIndicadores.filter(
      (m) => m.bancoHoras.ativo,
    ).length;
    const bancoHorasTotais = motoristasIndicadores.reduce(
      (acc, m) => ({
        ativo: acc.ativo || m.bancoHoras.ativo,
        creditoExtraMin: acc.creditoExtraMin + m.bancoHoras.creditoExtraMin,
        creditoCorrecaoMin:
          acc.creditoCorrecaoMin + m.bancoHoras.creditoCorrecaoMin,
        debitoMin: acc.debitoMin + m.bancoHoras.debitoMin,
        saldoMin: acc.saldoMin + m.bancoHoras.saldoMin,
      }),
      bancoHorasVazio(),
    );

    // Tendência diária: soma os `dias[]` de cada motorista (já
    // calculados pelo HoleriteService) por data-calendário, junta a
    // contagem de alertas do mesmo dia, e o crédito/débito de banco de
    // horas (só dos motoristas com o toggle ligado).
    const porDia = new Map<string, IndicadoresDiaTendencia>();
    const obterDia = (chave: string): IndicadoresDiaTendencia => {
      let d = porDia.get(chave);
      if (!d) {
        d = {
          dia: chave,
          direcaoMin: 0,
          esperaMin: 0,
          normalMin: 0,
          extraMin: 0,
          noturnoMin: 0,
          indefinidoMin: 0,
          alertas: 0,
          bancoHorasCreditoMin: 0,
          bancoHorasDebitoMin: 0,
          bancoHorasSaldoAcumuladoMin: 0,
        };
        porDia.set(chave, d);
      }
      return d;
    };
    for (const r of resultados) {
      for (const dia of r.dias) {
        const d = obterDia(dia.dia);
        d.direcaoMin += dia.direcaoMin;
        d.esperaMin += dia.esperaMin;
        d.normalMin += dia.normalMin;
        d.extraMin += dia.extraMin;
        d.noturnoMin += dia.noturnoMin;
        d.indefinidoMin += dia.indefinidoMin;
      }
    }
    for (const [chaveDia, qtd] of alertasPorDia.entries()) {
      obterDia(chaveDia).alertas += qtd;
    }
    // Crédito de banco de horas por dia: extraMin do dia, só pros
    // motoristas com o toggle ligado (reaproveita `dias[]` de novo, já
    // calculado acima, sem chamar o holerite outra vez).
    for (let i = 0; i < motoristas.length; i++) {
      if (!bancoHorasPorMotorista[i].info.ativo) continue;
      for (const dia of resultados[i].dias) {
        obterDia(dia.dia).bancoHorasCreditoMin += dia.extraMin;
      }
      for (const ajuste of bancoHorasPorMotorista[i].ajustes) {
        const chaveDia = ajuste.data.toISOString().slice(0, 10);
        if (ajuste.tipo === TipoAjusteBancoHoras.CORRECAO_CREDITO) {
          obterDia(chaveDia).bancoHorasCreditoMin += ajuste.minutos;
        } else {
          obterDia(chaveDia).bancoHorasDebitoMin += ajuste.minutos;
        }
      }
    }

    const tendenciaDiaria = Array.from(porDia.values()).sort((a, b) =>
      a.dia.localeCompare(b.dia),
    );
    let saldoAcumulado = 0;
    for (const dia of tendenciaDiaria) {
      saldoAcumulado += dia.bancoHorasCreditoMin - dia.bancoHorasDebitoMin;
      dia.bancoHorasSaldoAcumuladoMin = saldoAcumulado;
    }

    // Rodada 63: um motorista com 0min não é "candidato a rebalancear
    // rota/escala" nem "está esperando" , é ausência de excesso/espera.
    // Antes disso o .slice(0, 10) trazia entradas zeradas sempre que
    // havia menos de 10 motoristas com valor real, fazendo o ranking
    // aparentar (incorretamente) que alguém com 00:00 era destaque.
    // Filtramos > 0 ANTES do slice, então o ranking fica vazio quando
    // nenhum motorista tem valor a exibir.
    const rankingHorasExtras = [...motoristasIndicadores]
      .filter((m) => m.extraMin > 0)
      .sort((a, b) => b.extraMin - a.extraMin)
      .slice(0, 10)
      .map((m) => ({
        motoristaId: m.motoristaId,
        nome: m.nome,
        valorMin: m.extraMin,
      }));
    const rankingTempoEspera = [...motoristasIndicadores]
      .filter((m) => m.esperaMin > 0)
      .sort((a, b) => b.esperaMin - a.esperaMin)
      .slice(0, 10)
      .map((m) => ({
        motoristaId: m.motoristaId,
        nome: m.nome,
        valorMin: m.esperaMin,
      }));
    // Rodada 68 , quem mais fica com jornada aberta sem escolher etapa
    // é quem mais precisa de orientação/treinamento sobre o uso do
    // app, ou pode estar com jornadas abertas demais no fim do dia.
    const rankingTempoIndefinido = [...motoristasIndicadores]
      .filter((m) => m.indefinidoMin > 0)
      .sort((a, b) => b.indefinidoMin - a.indefinidoMin)
      .slice(0, 10)
      .map((m) => ({
        motoristaId: m.motoristaId,
        nome: m.nome,
        valorMin: m.indefinidoMin,
      }));

    return {
      periodoInicio: dataInicio.toISOString(),
      periodoFim: dataFim.toISOString(),
      motoristaFiltro: motoristaId ?? null,
      motoristas: motoristasIndicadores,
      totais: {
        ...totaisAcumulados,
        alertas: alertasTotais,
        percentualExtraSobreDirecao: pct(
          totaisAcumulados.extraMin,
          totaisAcumulados.direcaoMin,
        ),
        percentualEsperaSobreTotal: pct(
          totaisAcumulados.esperaMin,
          totaisAcumulados.direcaoMin + totaisAcumulados.esperaMin,
        ),
        percentualNoturnoSobreDirecao: pct(
          totaisAcumulados.noturnoMin,
          totaisAcumulados.direcaoMin,
        ),
        percentualIndefinidoSobreJornada: pct(
          totaisAcumulados.indefinidoMin,
          totaisAcumulados.direcaoMin +
            totaisAcumulados.esperaMin +
            totaisAcumulados.indefinidoMin,
        ),
        bancoHoras: bancoHorasTotais,
      },
      motoristasComBancoHorasAtivo,
      tendenciaDiaria,
      rankingHorasExtras,
      rankingTempoEspera,
      rankingTempoIndefinido,
    };
  }

  /**
   * Export para RH , CSV com as horas completas e SEPARADAS por
   * motorista e por dia (direção/espera/normal/extra/noturno), sem
   * nenhum valor em R$: quem paga o quê e quanto é decisão do RH fora
   * da plataforma (restrição explícita do usuário). Uma linha por
   * motorista+dia, mais uma linha de total no fim de cada motorista.
   */
  async exportarCsv(
    grupoId: string,
    dataInicio: Date,
    dataFim: Date,
    motoristaId?: string,
  ): Promise<string> {
    if (motoristaId) {
      await this.tenant.verificarMotoristaNoGrupo(motoristaId, grupoId);
    }

    const motoristas = await this.prisma.motorista.findMany({
      where: {
        empresa: { grupoId },
        status: StatusMotorista.ATIVO,
        ...(motoristaId ? { id: motoristaId } : {}),
      },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });

    const opcoes = {
      direcaoEspera: true,
      normalExtra: true,
      adicionalNoturno: true,
    };
    const linhas: string[] = [
      'motorista,dia,horas_direcao,horas_espera,horas_normais,horas_extras,horas_adicional_noturno,horas_indefinido',
    ];

    const escaparCampo = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const minParaHoras = (min: number) => (min / 60).toFixed(2);

    for (const m of motoristas) {
      const resultado = await this.holerite.calcular(
        m.id,
        dataInicio,
        dataFim,
        opcoes,
        grupoId,
      );
      for (const dia of resultado.dias) {
        linhas.push(
          [
            escaparCampo(m.nome),
            dia.dia,
            minParaHoras(dia.direcaoMin),
            minParaHoras(dia.esperaMin),
            minParaHoras(dia.normalMin),
            minParaHoras(dia.extraMin),
            minParaHoras(dia.noturnoMin),
            minParaHoras(dia.indefinidoMin),
          ].join(','),
        );
      }
      linhas.push(
        [
          escaparCampo(`${m.nome} (TOTAL)`),
          '',
          minParaHoras(resultado.totais.direcaoMin),
          minParaHoras(resultado.totais.esperaMin),
          minParaHoras(resultado.totais.normalMin),
          minParaHoras(resultado.totais.extraMin),
          minParaHoras(resultado.totais.noturnoMin),
          minParaHoras(resultado.totais.indefinidoMin),
        ].join(','),
      );
    }

    return linhas.join('\n');
  }
}
