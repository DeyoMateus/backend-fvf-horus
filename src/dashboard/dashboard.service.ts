import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  SeveridadeAlerta,
  StatusMotorista,
  TipoAlertaJornada,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  OFFSET_BRT_MS,
  chaveDiaBrt,
  marcarHorario,
  offsetValido,
} from '../common/fuso/fuso-brasil.util';

/**
 * Alertas que representam RISCO DE FRAUDE especificamente (subconjunto
 * de TipoAlertaJornada) , separado dos alertas de mero limite legal
 * (direção contínua, jornada de direção, espera), pra dar ao gestor um
 * número só de "quanto risco de fraude teve" sem misturar com "quanto
 * a operação chegou perto do limite legal", que são problemas
 * diferentes (o segundo é sobre gestão de escala, o primeiro é sobre
 * confiabilidade do dado).
 */
export const TIPOS_ALERTA_RISCO_FRAUDE: TipoAlertaJornada[] = [
  TipoAlertaJornada.OCIOSIDADE_DIRECAO_SUSPEITA,
  TipoAlertaJornada.VELOCIDADE_IMPOSSIVEL_ENTRE_REGISTROS,
  TipoAlertaJornada.RELOGIO_DISPOSITIVO_SUSPEITO,
  TipoAlertaJornada.SEQUENCIA_JORNADA_MUITO_RAPIDA,
  TipoAlertaJornada.ODOMETRO_REGRESSIVO,
  TipoAlertaJornada.INTEGRIDADE_DISPOSITIVO_SUSPEITA,
  TipoAlertaJornada.INTEGRIDADE_CADEIA_VIOLADA,
];

// Jornada aberta (INICIO_JORNADA sem FIM_JORNADA correspondente) por
// mais que isso é ela mesma um sinal de risco operacional , motorista
// esqueceu de encerrar, ou turno anormalmente longo. 16h é folgado de
// propósito (jornada+espera prolongada é legal em cenários de espera
// de carga/descarga), só pega os casos claramente fora do padrão.
const HORAS_JORNADA_ABERTA_ALERTA = 16;

/** Chaves dos indicadores do gráfico "Evolução ao longo do tempo" que o gestor pode clicar pra ver o detalhe do dia (mesmo espírito do CardPainel, mas por dia+indicador em vez de estado atual). */
export type ChaveIndicadorTendencia =
  | 'registros'
  | 'alertasCritico'
  | 'alertasAtencao'
  | 'alertasInfo'
  | 'riscoFraude'
  | 'horasDirecao'
  | 'horasEspera'
  // Rodada 68 , jornada aberta sem etapa em aberto (nem direção, nem
  // descanso, nem espera, nem "aguardando documentação").
  | 'horasIndefinido';

/** Chaves dos cards do painel que o gestor pode clicar pra ver o detalhe (lista de motoristas ou alertas por trás do número). */
export type CardPainel =
  | 'ativos'
  | 'em-direcao'
  | 'em-descanso'
  | 'em-espera'
  | 'jornada-aberta-sem-sub-evento'
  | 'sem-jornada-aberta'
  | 'sem-nenhum-registro'
  | 'alertas-criticos'
  | 'alertas-atencao'
  | 'alertas-24h'
  | 'risco-fraude-7d';

interface LinhaEstadoAtual {
  motoristaId: string;
  nome: string;
  tipoEvento: string;
  timestampEvento: Date;
}

interface LinhaContagemDia {
  dia: Date;
  total: bigint | number;
}

interface LinhaContagemDiaSeveridade extends LinhaContagemDia {
  severidade: SeveridadeAlerta;
}

interface LinhaHorasDia {
  dia: Date;
  minutos_direcao: number | null;
  minutos_espera: number | null;
  minutos_indefinido: number | null;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fotografia do agora: quantos motoristas estão em cada estado,
   * quantos alertas estão em aberto, e o que precisa de atenção
   * imediata. Pensado pra ficar na tela e ser reconsultado (polling do
   * frontend), então cada consulta é rápida (index em motoristaId/data,
   * nada de full scan).
   */
  async resumo(grupoId: string) {
    const agora = new Date();
    const inicio24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    const inicio7d = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalMotoristasAtivos,
      estadosAtuais,
      alertasAbertosPorSeveridade,
      alertas24h,
      riscoFraude7d,
      topTipos7d,
      empresaReferencia,
    ] = await Promise.all([
      this.prisma.motorista.count({
        where: { empresa: { grupoId }, status: StatusMotorista.ATIVO },
      }),
      this.estadoAtualPorMotorista(grupoId),
      this.prisma.alertaJornada.groupBy({
        by: ['severidade'],
        where: { motorista: { empresa: { grupoId } }, visualizadoEm: null },
        _count: { severidade: true },
      }),
      this.prisma.alertaJornada.count({
        where: {
          motorista: { empresa: { grupoId } },
          createdAt: { gte: inicio24h },
        },
      }),
      this.prisma.alertaJornada.count({
        where: {
          motorista: { empresa: { grupoId } },
          tipo: { in: TIPOS_ALERTA_RISCO_FRAUDE },
          createdAt: { gte: inicio7d },
        },
      }),
      this.prisma.alertaJornada.groupBy({
        by: ['tipo'],
        where: {
          motorista: { empresa: { grupoId } },
          createdAt: { gte: inicio7d },
        },
        _count: { tipo: true },
        orderBy: { _count: { tipo: 'desc' } },
        take: 5,
      }),
      // Rodada 146: fuso da transportadora (só para exibir horários no painel).
      this.prisma.empresa.findFirst({
        where: { grupoId },
        orderBy: { createdAt: 'asc' },
        select: { fusoHorario: true },
      }),
    ]);

    const contagemEstados = {
      emDirecao: 0,
      emDescanso: 0,
      emEspera: 0,
      jornadaAbertaSemSubEvento: 0, // bateu INICIO_JORNADA (ou fechou um sub-evento) mas não está em nenhum dos três acima agora
      semJornadaAberta: 0, // último evento foi FIM_JORNADA
    };
    const jornadasAbertasHaMuitoTempo: {
      motoristaId: string;
      nome: string;
      desde: Date;
      horasAberta: number;
    }[] = [];

    for (const linha of estadosAtuais) {
      switch (linha.tipoEvento) {
        case 'INICIO_DIRECAO':
          contagemEstados.emDirecao++;
          break;
        case 'INICIO_DESCANSO':
          contagemEstados.emDescanso++;
          break;
        case 'ESPERA_CARGA_DESCARGA':
          contagemEstados.emEspera++;
          break;
        case 'FIM_JORNADA':
          contagemEstados.semJornadaAberta++;
          break;
        default:
          // INICIO_JORNADA, FIM_DIRECAO, FIM_DESCANSO, FIM_ESPERA_CARGA_DESCARGA, FIM_DESCARREGAMENTO
          contagemEstados.jornadaAbertaSemSubEvento++;
      }
    }

    // Busca separada e mais barata: só o INICIO_JORNADA mais recente de
    // cada motorista cuja jornada segue aberta (não tem FIM_JORNADA
    // depois), pra medir há quanto tempo está aberta.
    const jornadasEmAberto = await this.jornadasEmAbertoComInicio(grupoId);
    for (const j of jornadasEmAberto) {
      const horasAberta =
        (agora.getTime() - j.inicioJornada.getTime()) / 3_600_000;
      if (horasAberta >= HORAS_JORNADA_ABERTA_ALERTA) {
        jornadasAbertasHaMuitoTempo.push({
          motoristaId: j.motoristaId,
          nome: j.nome,
          desde: j.inicioJornada,
          horasAberta: Math.round(horasAberta * 10) / 10,
        });
      }
    }

    const motoristasComRegistro = estadosAtuais.length;

    const abertosPorSeveridade = { CRITICO: 0, ATENCAO: 0, INFO: 0 };
    for (const grupo of alertasAbertosPorSeveridade) {
      abertosPorSeveridade[grupo.severidade] = grupo._count.severidade;
    }

    return {
      atualizadoEm: agora.toISOString(),
      fusoHorario: empresaReferencia?.fusoHorario ?? 'America/Sao_Paulo',
      motoristas: {
        totalAtivos: totalMotoristasAtivos,
        semNenhumRegistro: Math.max(
          0,
          totalMotoristasAtivos - motoristasComRegistro,
        ),
        emDirecao: contagemEstados.emDirecao,
        emDescanso: contagemEstados.emDescanso,
        emEspera: contagemEstados.emEspera,
        jornadaAbertaSemSubEvento: contagemEstados.jornadaAbertaSemSubEvento,
        semJornadaAberta: contagemEstados.semJornadaAberta,
        jornadasAbertasHaMuitoTempo: jornadasAbertasHaMuitoTempo.sort(
          (a, b) => b.horasAberta - a.horasAberta,
        ),
      },
      alertas: {
        abertos: abertosPorSeveridade,
        totalAbertos:
          abertosPorSeveridade.CRITICO +
          abertosPorSeveridade.ATENCAO +
          abertosPorSeveridade.INFO,
        ultimas24h: alertas24h,
        riscoFraudeUltimos7d: riscoFraude7d,
        topTipos7d: topTipos7d.map((t) => ({
          tipo: t.tipo,
          quantidade: t._count.tipo,
        })),
      },
    };
  }

  /**
   * Detalhe por trás de um card do painel , a lista de motoristas (ou
   * de alertas, pros cards de risco) que compõem aquele número, pra
   * abrir quando o gestor clica no card. Reaproveita as mesmas
   * consultas de `resumo()` sempre que possível, em vez de duplicar
   * lógica, pra nunca divergir do número mostrado no card.
   */
  async detalheCard(grupoId: string, card: CardPainel) {
    switch (card) {
      case 'ativos': {
        const motoristas = await this.prisma.motorista.findMany({
          where: { empresa: { grupoId }, status: StatusMotorista.ATIVO },
          select: { id: true, nome: true },
          orderBy: { nome: 'asc' },
        });
        return {
          tipo: 'motoristas' as const,
          itens: motoristas.map((m) => ({
            motoristaId: m.id,
            nome: m.nome,
            detalhe: null,
          })),
        };
      }

      case 'em-direcao':
      case 'em-descanso':
      case 'em-espera':
      case 'jornada-aberta-sem-sub-evento':
      case 'sem-jornada-aberta': {
        const tipoPorCard: Record<string, string[]> = {
          'em-direcao': ['INICIO_DIRECAO'],
          'em-descanso': ['INICIO_DESCANSO'],
          'em-espera': ['ESPERA_CARGA_DESCARGA'],
          'sem-jornada-aberta': ['FIM_JORNADA'],
          // tudo que não cai nos quatro estados "nomeados" acima
          'jornada-aberta-sem-sub-evento': [
            'INICIO_JORNADA',
            'FIM_DIRECAO',
            'FIM_DESCANSO',
            'FIM_ESPERA_CARGA_DESCARGA',
            'FIM_DESCARREGAMENTO',
          ],
        };
        const tiposAlvo = new Set(tipoPorCard[card]);
        const estadosAtuais = await this.estadoAtualPorMotorista(grupoId);
        const filtrados = estadosAtuais.filter((l) =>
          tiposAlvo.has(l.tipoEvento),
        );
        const agora = new Date();
        // Rodada 159: em "Motoristas em direção" o detalhe traz há quanto
        // tempo o motorista está em direção contínua e em que faixa está
        // (normal / atenção 5h / crítico 5h30 = limite excedido).
        const direcaoContinua =
          card === 'em-direcao'
            ? await this.direcaoContinuaPorMotorista(
                filtrados.map((l) => l.motoristaId),
                agora,
              )
            : new Map<string, number>();
        return {
          tipo: 'motoristas' as const,
          itens: filtrados
            .map((l) => ({
              motoristaId: l.motoristaId,
              nome: l.nome,
              // Rodada 68 , pedido do usuário: "precisa direcionar o
              // usuário a escolher alguma ação" , do lado do gestor,
              // isso significa mostrar HÁ QUANTO TEMPO cada motorista
              // está com "tempo indefinido" correndo, não só o horário
              // do último evento, pra dar pra identificar rápido quem
              // está preso nesse estado.
              detalhe:
                card === 'jornada-aberta-sem-sub-evento'
                  ? `Tempo indefinido há ${this.formatarHorasMinutos((agora.getTime() - l.timestampEvento.getTime()) / 60000)} (desde ${marcarHorario(l.timestampEvento)})`
                  : card === 'em-direcao' && direcaoContinua.has(l.motoristaId)
                    ? `${l.tipoEvento} às ${marcarHorario(l.timestampEvento)} · ${this.descreverDirecaoContinua(direcaoContinua.get(l.motoristaId)!)}`
                    : `${l.tipoEvento} às ${marcarHorario(l.timestampEvento)}`,
            }))
            .sort((a, b) => a.nome.localeCompare(b.nome)),
        };
      }

      case 'sem-nenhum-registro': {
        const [ativos, estadosAtuais] = await Promise.all([
          this.prisma.motorista.findMany({
            where: { empresa: { grupoId }, status: StatusMotorista.ATIVO },
            select: { id: true, nome: true },
          }),
          this.estadoAtualPorMotorista(grupoId),
        ]);
        const comRegistro = new Set(estadosAtuais.map((l) => l.motoristaId));
        const semRegistro = ativos.filter((m) => !comRegistro.has(m.id));
        return {
          tipo: 'motoristas' as const,
          itens: semRegistro
            .map((m) => ({ motoristaId: m.id, nome: m.nome, detalhe: null }))
            .sort((a, b) => a.nome.localeCompare(b.nome)),
        };
      }

      case 'alertas-criticos':
      case 'alertas-atencao': {
        const severidade =
          card === 'alertas-criticos'
            ? SeveridadeAlerta.CRITICO
            : SeveridadeAlerta.ATENCAO;
        const alertas = await this.prisma.alertaJornada.findMany({
          where: {
            motorista: { empresa: { grupoId } },
            visualizadoEm: null,
            severidade,
          },
          include: { motorista: { select: { id: true, nome: true } } },
          orderBy: { createdAt: 'desc' },
          take: 200,
        });
        return { tipo: 'alertas' as const, itens: this.mapearAlertas(alertas) };
      }

      case 'alertas-24h': {
        const inicio24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const alertas = await this.prisma.alertaJornada.findMany({
          where: {
            motorista: { empresa: { grupoId } },
            createdAt: { gte: inicio24h },
          },
          include: { motorista: { select: { id: true, nome: true } } },
          orderBy: { createdAt: 'desc' },
          take: 200,
        });
        return { tipo: 'alertas' as const, itens: this.mapearAlertas(alertas) };
      }

      case 'risco-fraude-7d': {
        const inicio7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const alertas = await this.prisma.alertaJornada.findMany({
          where: {
            motorista: { empresa: { grupoId } },
            tipo: { in: TIPOS_ALERTA_RISCO_FRAUDE },
            createdAt: { gte: inicio7d },
          },
          include: { motorista: { select: { id: true, nome: true } } },
          orderBy: { createdAt: 'desc' },
          take: 200,
        });
        return { tipo: 'alertas' as const, itens: this.mapearAlertas(alertas) };
      }

      default:
        return { tipo: 'motoristas' as const, itens: [] };
    }
  }

  private mapearAlertas(
    alertas: {
      id: string;
      tipo: TipoAlertaJornada;
      severidade: SeveridadeAlerta;
      createdAt: Date;
      motorista: { id: string; nome: string };
    }[],
  ) {
    return alertas.map((a) => ({
      alertaId: a.id,
      motoristaId: a.motorista.id,
      nome: a.motorista.nome,
      tipo: a.tipo,
      severidade: a.severidade,
      createdAt: a.createdAt,
    }));
  }

  /**
   * Série diária dos últimos `dias` dias , volume de registros, alertas
   * por severidade, alertas de risco de fraude, e horas de
   * direção/espera (o KPI de eficiência mais direto: menos espera por
   * quilômetro/jornada = operação mais eficiente, e é literalmente o
   * dado por trás do Dossiê de Cobrança de espera). Pensado pra virar
   * gráfico de linha/barra no painel, pra o gestor acompanhar se as
   * ações que ele tomou (treinar motorista, cobrar do cliente que
   * segura o caminhão na doca) estão melhorando com o tempo.
   */
  async tendencia(
    grupoId: string,
    opts: {
      dias?: number;
      desde?: string;
      ate?: string;
      /** Fuso do computador de quem vê (min a leste do UTC); alertas por dia seguem ele. */
      fusoOffsetMin?: number;
    },
  ) {
    const offGestor = offsetValido(opts.fusoOffsetMin)
      ? opts.fusoOffsetMin
      : -180;
    // BUG DE DADOS CORRIGIDO AQUI (histórico): antes, `desde` era "agora
    // menos N dias" (um instante exato, não meia-noite) , e o loop que
    // monta o mapa de dias (mais abaixo) soma exatamente `diasClamped`
    // saltos de 24h a partir dali. Isso fazia o ÚLTIMO balde do mapa cair
    // em "agora menos 1 dia" (ontem), nunca em HOJE , então todo
    // registro/alerta de HOJE não encontrava nenhuma chave correspondente
    // no mapa e era silenciosamente descartado do gráfico (`if (linha)
    // ...` não executa quando `linha` é undefined). Também cortava as
    // primeiras horas do dia mais antigo do período, por `desde` não
    // começar à meia-noite. A correção ancora o período em dias de
    // calendário (meia-noite UTC).
    //
    // Pedido do usuário (rodada posterior): além dos atalhos de 7/30/90
    // dias (que continuam usando `dias`, sempre terminando hoje), poder
    // extrair os dados por um período EXATO que o usuário define
    // (`desde`/`ate`, os dois obrigatórios juntos pra valer). `ate` é
    // inclusivo (o dia inteiro, até 23:59:59.999); daí pra frente, todas
    // as consultas abaixo passaram a ter também um limite superior
    // (`diaFimExclusivo`), que antes não existia (implicitamente "até
    // agora", porque o mapa de dias nunca ia além de hoje).
    let diaInicio: Date;
    let diaFimExclusivo: Date;
    let diasClamped: number;
    if (opts.desde && opts.ate) {
      const diaInicioPedido = new Date(`${opts.desde}T00:00:00.000Z`);
      const diaFimPedido = new Date(`${opts.ate}T00:00:00.000Z`);
      if (
        Number.isNaN(diaInicioPedido.getTime()) ||
        Number.isNaN(diaFimPedido.getTime()) ||
        diaFimPedido < diaInicioPedido
      ) {
        throw new BadRequestException('Período inválido (desde/ate)');
      }
      diaFimExclusivo = new Date(diaFimPedido.getTime() + 24 * 60 * 60 * 1000);
      const diasPedidos = Math.round(
        (diaFimExclusivo.getTime() - diaInicioPedido.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      diasClamped = Math.min(Math.max(diasPedidos, 1), 180);
      // Se o período pedido passar de 180 dias, mantém o FIM pedido e
      // encurta o início (mais previsível pro usuário do que cortar o
      // fim de um período que ele escolheu a dedo).
      diaInicio = new Date(
        diaFimExclusivo.getTime() - diasClamped * 24 * 60 * 60 * 1000,
      );
    } else {
      diasClamped = Math.min(Math.max(opts.dias ?? 30, 1), 180);
      // Rodada 144: "hoje" é o dia civil de Brasília.
      const hojeUtc = new Date(
        chaveDiaBrt(new Date(), offGestor) + 'T00:00:00.000Z',
      );
      diaInicio = new Date(
        hojeUtc.getTime() - (diasClamped - 1) * 24 * 60 * 60 * 1000,
      );
      diaFimExclusivo = new Date(hojeUtc.getTime() + 24 * 60 * 60 * 1000);
    }
    const desde = diaInicio;
    // Rodada 144: `desde`/`diaFimExclusivo` são DIAS CIVIS (meia-noite UTC
    // como "só data", e servem de chave do mapa); nas consultas viram
    // instantes reais (00:00 BRT), e o "dia" de cada linha é agrupado por
    // dia civil de Brasília (timestamp - 3h antes do date_trunc).
    const desdeInstante = new Date(desde.getTime() + OFFSET_BRT_MS);
    const fimExclusivoInstante = new Date(
      diaFimExclusivo.getTime() + OFFSET_BRT_MS,
    );
    // Rodada 147: registros/horas são agrupados pelo dia no FUSO DO
    // MOTORISTA no toque (fusoOffsetMin; sem ele, Brasília). A faixa de
    // instantes cobre todos os fusos do Brasil (+2h..+5h) e o filtro exato
    // é feito sobre o dia calculado.
    // Rodada 148: alertas por dia seguem o fuso de quem está vendo.
    const desdeAlerta = new Date(desde.getTime() - offGestor * 60_000);
    const fimAlerta = new Date(diaFimExclusivo.getTime() - offGestor * 60_000);
    const desdeAmplo = new Date(desde.getTime() + 2 * 3_600_000);
    const fimAmplo = new Date(diaFimExclusivo.getTime() + 5 * 3_600_000);

    const [
      registrosPorDia,
      alertasPorDiaSeveridade,
      fraudePorDia,
      horasPorDia,
    ] = await Promise.all([
      this.prisma.$queryRaw<LinhaContagemDia[]>(Prisma.sql`
        SELECT date_trunc('day', r."timestampEvento" + COALESCE(r."fusoOffsetMin", -180) * interval '1 minute') AS dia, COUNT(*)::int AS total
        FROM registros_jornada r
        JOIN motoristas m ON m.id = r."motoristaId"
        JOIN empresas emp ON emp.id = m."empresaId"
        WHERE emp."grupoId" = ${grupoId}
          AND r."timestampEvento" >= ${desdeAmplo}
          AND r."timestampEvento" < ${fimAmplo}
          AND date_trunc('day', r."timestampEvento" + COALESCE(r."fusoOffsetMin", -180) * interval '1 minute') >= ${desde}
          AND date_trunc('day', r."timestampEvento" + COALESCE(r."fusoOffsetMin", -180) * interval '1 minute') < ${diaFimExclusivo}
        GROUP BY 1
        ORDER BY 1
      `),
      this.prisma.$queryRaw<LinhaContagemDiaSeveridade[]>(Prisma.sql`
        SELECT date_trunc('day', a."createdAt" + ${offGestor}::int * interval '1 minute') AS dia, a.severidade, COUNT(*)::int AS total
        FROM alertas_jornada a
        JOIN motoristas m ON m.id = a."motoristaId"
        JOIN empresas emp ON emp.id = m."empresaId"
        WHERE emp."grupoId" = ${grupoId}
          AND a."createdAt" >= ${desdeAlerta}
          AND a."createdAt" < ${fimAlerta}
        GROUP BY 1, 2
        ORDER BY 1
      `),
      this.prisma.$queryRaw<LinhaContagemDia[]>(Prisma.sql`
        SELECT date_trunc('day', a."createdAt" + ${offGestor}::int * interval '1 minute') AS dia, COUNT(*)::int AS total
        FROM alertas_jornada a
        JOIN motoristas m ON m.id = a."motoristaId"
        JOIN empresas emp ON emp.id = m."empresaId"
        WHERE emp."grupoId" = ${grupoId}
          AND a."createdAt" >= ${desdeAlerta}
          AND a."createdAt" < ${fimAlerta}
          AND a.tipo::text IN (${Prisma.join(TIPOS_ALERTA_RISCO_FRAUDE)})
        GROUP BY 1
        ORDER BY 1
      `),
      // Emparelha cada evento de fechamento (FIM_DIRECAO/FIM_ESPERA_CARGA_DESCARGA)
      // com o evento de abertura imediatamente anterior do MESMO motorista
      // (LAG por sequencial) pra somar a duração real do trecho , o dia
      // usado pro bucket é o dia em que o trecho COMEÇOU.
      //
      // Rodada 78 , pedido do usuário: "os gráficos devem levar em
      // consideração os lançamentos do RH". Antes esta série só olhava
      // `registros_jornada` (o que o próprio motorista bateu no app) ,
      // um trecho fechado pelo RH via `TratamentoPonto` (motorista
      // esqueceu de bater) nunca aparecia aqui, mesmo já entrando
      // certinho no fechamento/holerite (`HoleriteService`, que faz
      // esse mesmo merge desde a Rodada 26). `eventos_brutos` agora
      // une as duas origens ANTES do LAG, exatamente como
      // `HoleriteService.unificarEventos` já faz em JS , só que aqui em
      // SQL, porque a série é agregada direto no banco.
      this.prisma.$queryRaw<LinhaHorasDia[]>(Prisma.sql`
        WITH eventos_brutos AS (
          SELECT r."motoristaId", r."tipoEvento", r."timestampEvento", r."fusoOffsetMin"
          FROM registros_jornada r
          JOIN motoristas m ON m.id = r."motoristaId"
          JOIN empresas emp ON emp.id = m."empresaId"
          WHERE emp."grupoId" = ${grupoId} AND r."tipoEvento" != 'OUTRO'
          UNION ALL
          SELECT t."motoristaId", t."tipoEvento", t."timestampEvento", NULL::int AS "fusoOffsetMin"
          FROM tratamentos_ponto t
          JOIN motoristas m ON m.id = t."motoristaId"
          JOIN empresas emp ON emp.id = m."empresaId"
          WHERE emp."grupoId" = ${grupoId} AND t."tipoEvento" != 'OUTRO'
        ),
        eventos AS (
          -- Exclui OUTRO da sequência ANTES do LAG: uma anotação livre
          -- batida no meio de um trecho de direção não pode "quebrar" o
          -- par início/fim (senão o LAG do FIM_DIRECAO aponta pro OUTRO
          -- em vez do INICIO_DIRECAO de verdade, e o trecho some da
          -- soma de horas por engano). Mesmo critério do app mobile
          -- (ultimoTipoEventoRelevanteRegistrado). Já filtrado lá em
          -- cima, em eventos_brutos, pras duas origens igual.
          SELECT
            "tipoEvento",
            "timestampEvento",
            LAG("tipoEvento") OVER (PARTITION BY "motoristaId" ORDER BY "timestampEvento") AS tipo_anterior,
            LAG("timestampEvento") OVER (PARTITION BY "motoristaId" ORDER BY "timestampEvento") AS tempo_anterior,
            LAG("fusoOffsetMin") OVER (PARTITION BY "motoristaId" ORDER BY "timestampEvento") AS fuso_anterior
          FROM eventos_brutos
        )
        SELECT
          date_trunc('day', tempo_anterior + COALESCE(fuso_anterior, -180) * interval '1 minute') AS dia,
          SUM(CASE WHEN "tipoEvento" = 'FIM_DIRECAO' AND tipo_anterior = 'INICIO_DIRECAO'
              THEN EXTRACT(EPOCH FROM ("timestampEvento" - tempo_anterior)) / 60.0 ELSE 0 END) AS minutos_direcao,
          SUM(CASE WHEN "tipoEvento" IN ('FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO') AND tipo_anterior = 'ESPERA_CARGA_DESCARGA'
              THEN EXTRACT(EPOCH FROM ("timestampEvento" - tempo_anterior)) / 60.0 ELSE 0 END) AS minutos_espera,
          -- Rodada 68 , "tempo indefinido": fechou uma etapa (ou bateu
          -- Início de jornada) e o próximo evento de verdade só veio
          -- depois. Mesma limitação de OUTRO já documentada acima (fica
          -- de fora da sequência antes do LAG) se aplica aqui: uma
          -- "aguardando documentação" no meio do intervalo não separa
          -- esse tempo do indefinido , aceito, mesmo critério de sempre.
          SUM(CASE WHEN "tipoEvento" IN ('INICIO_DIRECAO', 'INICIO_DESCANSO', 'ESPERA_CARGA_DESCARGA', 'FIM_JORNADA')
                AND tipo_anterior IN ('INICIO_JORNADA', 'FIM_DIRECAO', 'FIM_DESCANSO', 'FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO')
              THEN EXTRACT(EPOCH FROM ("timestampEvento" - tempo_anterior)) / 60.0 ELSE 0 END) AS minutos_indefinido
        FROM eventos
        WHERE tempo_anterior IS NOT NULL
          AND tempo_anterior >= ${desdeAmplo}
          AND tempo_anterior < ${fimAmplo}
          AND date_trunc('day', tempo_anterior + COALESCE(fuso_anterior, -180) * interval '1 minute') >= ${desde}
          AND date_trunc('day', tempo_anterior + COALESCE(fuso_anterior, -180) * interval '1 minute') < ${diaFimExclusivo}
        GROUP BY 1
        ORDER BY 1
      `),
    ]);

    // Monta um mapa dia (YYYY-MM-DD) -> linha consolidada, com todos os
    // dias do período presentes mesmo sem nenhum dado (0), pra o gráfico
    // no frontend não ter buracos.
    const porDia = new Map<
      string,
      {
        dia: string;
        registros: number;
        alertasCritico: number;
        alertasAtencao: number;
        alertasInfo: number;
        riscoFraude: number;
        horasDirecao: number;
        horasEspera: number;
        horasIndefinido: number;
      }
    >();

    for (let i = 0; i < diasClamped; i++) {
      const d = new Date(desde.getTime() + i * 24 * 60 * 60 * 1000);
      const chave = d.toISOString().slice(0, 10);
      porDia.set(chave, {
        dia: chave,
        registros: 0,
        alertasCritico: 0,
        alertasAtencao: 0,
        alertasInfo: 0,
        riscoFraude: 0,
        horasDirecao: 0,
        horasEspera: 0,
        horasIndefinido: 0,
      });
    }

    const chaveDia = (d: Date) => d.toISOString().slice(0, 10);

    for (const l of registrosPorDia) {
      const linha = porDia.get(chaveDia(l.dia));
      if (linha) linha.registros = Number(l.total);
    }
    for (const l of alertasPorDiaSeveridade) {
      const linha = porDia.get(chaveDia(l.dia));
      if (!linha) continue;
      if (l.severidade === 'CRITICO') linha.alertasCritico = Number(l.total);
      else if (l.severidade === 'ATENCAO')
        linha.alertasAtencao = Number(l.total);
      else linha.alertasInfo = Number(l.total);
    }
    for (const l of fraudePorDia) {
      const linha = porDia.get(chaveDia(l.dia));
      if (linha) linha.riscoFraude = Number(l.total);
    }
    for (const l of horasPorDia) {
      const linha = porDia.get(chaveDia(l.dia));
      if (!linha) continue;
      linha.horasDirecao =
        Math.round(((l.minutos_direcao ?? 0) / 60) * 10) / 10;
      linha.horasEspera = Math.round(((l.minutos_espera ?? 0) / 60) * 10) / 10;
      linha.horasIndefinido =
        Math.round(((l.minutos_indefinido ?? 0) / 60) * 10) / 10;
    }

    return Array.from(porDia.values());
  }

  /**
   * Detalhe por trás de UM PONTO do gráfico "Evolução ao longo do
   * tempo" (clicar numa barra/ponto de um dia+indicador abre a lista
   * das ações reais que compõem aquele número , mesmo espírito do
   * "clicar no card abre a lista de motoristas", só que por dia em vez
   * de estado atual; pensado pro mesmo uso que um drill-through de
   * Power BI). `dia` no formato AAAA-MM-DD (mesma chave usada em
   * `tendencia()`); `indicador` validado pelo controller contra uma
   * lista fechada antes de chegar aqui.
   */
  async tendenciaDetalhe(
    grupoId: string,
    dia: string,
    indicador: ChaveIndicadorTendencia,
    fusoOffsetMin?: number,
  ) {
    const diaCivil = new Date(`${dia}T00:00:00.000Z`);
    if (Number.isNaN(diaCivil.getTime())) {
      return { tipo: 'registros' as const, itens: [] };
    }
    // Rodada 148: o "dia" clicado no gráfico é civil. Registros e trechos
    // pertencem ao dia no fuso DO MOTORISTA no toque (mesmo critério da
    // série); alertas, ao dia no fuso de quem está vendo.
    const offGestor = offsetValido(fusoOffsetMin) ? fusoOffsetMin : -180;
    const inicioAmplo = new Date(diaCivil.getTime() + 2 * 3_600_000);
    const fimAmplo = new Date(diaCivil.getTime() + 24 * 3_600_000 + 5 * 3_600_000);
    const inicioDia = new Date(diaCivil.getTime() - offGestor * 60_000);
    const fimDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);

    switch (indicador) {
      case 'registros': {
        const registros = await this.prisma.registroJornada.findMany({
          where: {
            motorista: { empresa: { grupoId } },
            timestampEvento: { gte: inicioAmplo, lt: fimAmplo },
          },
          include: { motorista: { select: { id: true, nome: true } } },
          orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
          take: 600,
        });
        const doDia = registros.filter(
          (r) =>
            chaveDiaBrt(r.timestampEvento, r.fusoOffsetMin ?? -180) === dia,
        );
        return {
          tipo: 'registros' as const,
          itens: doDia.map((r) => ({
            registroId: r.id,
            motoristaId: r.motorista.id,
            nome: r.motorista.nome,
            tipoEvento: r.tipoEvento,
            timestampEvento: r.timestampEvento,
          })),
        };
      }

      case 'alertasCritico':
      case 'alertasAtencao':
      case 'alertasInfo': {
        const severidade =
          indicador === 'alertasCritico'
            ? SeveridadeAlerta.CRITICO
            : indicador === 'alertasAtencao'
              ? SeveridadeAlerta.ATENCAO
              : SeveridadeAlerta.INFO;
        const alertas = await this.prisma.alertaJornada.findMany({
          where: {
            motorista: { empresa: { grupoId } },
            severidade,
            createdAt: { gte: inicioDia, lt: fimDia },
          },
          include: { motorista: { select: { id: true, nome: true } } },
          orderBy: { createdAt: 'asc' },
          take: 300,
        });
        return { tipo: 'alertas' as const, itens: this.mapearAlertas(alertas) };
      }

      case 'riscoFraude': {
        const alertas = await this.prisma.alertaJornada.findMany({
          where: {
            motorista: { empresa: { grupoId } },
            tipo: { in: TIPOS_ALERTA_RISCO_FRAUDE },
            createdAt: { gte: inicioDia, lt: fimDia },
          },
          include: { motorista: { select: { id: true, nome: true } } },
          orderBy: { createdAt: 'asc' },
          take: 300,
        });
        return { tipo: 'alertas' as const, itens: this.mapearAlertas(alertas) };
      }

      case 'horasDirecao':
      case 'horasEspera':
      case 'horasIndefinido': {
        // Mesmo pareamento início/fim (LAG por sequencial, ignorando
        // OUTRO) já usado em tendencia() pra somar horas , aqui, em vez
        // de somar, devolve cada TRECHO individual do dia (quem, início,
        // fim, minutos), pra o gestor ver exatamente quais eventos
        // compõem aquela soma de horas. "horasIndefinido" (Rodada 68) é
        // o único com mais de um tipo possível em cada ponta , o
        // motorista pode ter fechado a etapa indefinida escolhendo
        // qualquer uma das três ou encerrando a jornada.
        const tipoFim =
          indicador === 'horasDirecao'
            ? ['FIM_DIRECAO']
            : indicador === 'horasEspera'
              ? ['FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO']
              : [
                  'INICIO_DIRECAO',
                  'INICIO_DESCANSO',
                  'ESPERA_CARGA_DESCARGA',
                  'FIM_JORNADA',
                ];
        const tipoInicio =
          indicador === 'horasDirecao'
            ? ['INICIO_DIRECAO']
            : indicador === 'horasEspera'
              ? ['ESPERA_CARGA_DESCARGA']
              : [
                  'INICIO_JORNADA',
                  'FIM_DIRECAO',
                  'FIM_DESCANSO',
                  'FIM_ESPERA_CARGA_DESCARGA',
                  'FIM_DESCARREGAMENTO',
                ];
        // Rodada 78 , o mesmo motivo documentado em tendencia() acima:
        // "os gráficos devem levar em consideração os lançamentos do
        // RH". Esta consulta de detalhe (trechos) ficou de fora daquela
        // correção na época e continuava olhando só `registros_jornada`
        // , então um trecho fechado pelo RH via `TratamentoPonto` (ex.:
        // motorista esqueceu de bater "Fim de espera") entrava na SOMA
        // do card/gráfico (que já unificava as duas origens), mas
        // "sumia" ao clicar pra ver o detalhe do dia (o popup achava a
        // lista vazia mesmo com horas > 0 no card). Corrigido pra usar o
        // mesmo `eventos_brutos` (UNION ALL) de `tendencia()`.
        const trechos = await this.prisma.$queryRaw<
          {
            motoristaId: string;
            nome: string;
            inicio: Date;
            fim: Date;
            minutos: number;
          }[]
        >(Prisma.sql`
          WITH eventos_brutos AS (
            SELECT r."motoristaId", m.nome AS nome, r."tipoEvento", r."timestampEvento", r."fusoOffsetMin"
            FROM registros_jornada r
            JOIN motoristas m ON m.id = r."motoristaId"
            JOIN empresas emp ON emp.id = m."empresaId"
            WHERE emp."grupoId" = ${grupoId} AND r."tipoEvento" != 'OUTRO'
            UNION ALL
            SELECT t."motoristaId", m.nome AS nome, t."tipoEvento", t."timestampEvento", NULL::int AS "fusoOffsetMin"
            FROM tratamentos_ponto t
            JOIN motoristas m ON m.id = t."motoristaId"
            JOIN empresas emp ON emp.id = m."empresaId"
            WHERE emp."grupoId" = ${grupoId} AND t."tipoEvento" != 'OUTRO'
          ),
          eventos AS (
            SELECT
              "motoristaId",
              nome,
              "tipoEvento",
              "timestampEvento",
              LAG("tipoEvento") OVER (PARTITION BY "motoristaId" ORDER BY "timestampEvento") AS tipo_anterior,
              LAG("timestampEvento") OVER (PARTITION BY "motoristaId" ORDER BY "timestampEvento") AS tempo_anterior,
              LAG("fusoOffsetMin") OVER (PARTITION BY "motoristaId" ORDER BY "timestampEvento") AS fuso_anterior
            FROM eventos_brutos
          )
          SELECT "motoristaId", nome, tempo_anterior AS inicio, "timestampEvento" AS fim,
            EXTRACT(EPOCH FROM ("timestampEvento" - tempo_anterior)) / 60.0 AS minutos
          FROM eventos
          WHERE tempo_anterior IS NOT NULL
            AND tempo_anterior >= ${inicioAmplo} AND tempo_anterior < ${fimAmplo}
            AND date_trunc('day', tempo_anterior + COALESCE(fuso_anterior, -180) * interval '1 minute') = ${diaCivil}
            AND "tipoEvento"::text IN (${Prisma.join(tipoFim)})
            AND tipo_anterior::text IN (${Prisma.join(tipoInicio)})
          ORDER BY tempo_anterior ASC
        `);
        return {
          tipo: 'trechos' as const,
          itens: trechos.map((t) => ({
            motoristaId: t.motoristaId,
            nome: t.nome,
            inicio: t.inicio,
            fim: t.fim,
            minutos: Math.round(Number(t.minutos)),
          })),
        };
      }

      default:
        return { tipo: 'registros' as const, itens: [] };
    }
  }

  /** Último evento relevante (ignora OUTRO) de cada motorista ATIVO da empresa, em UMA consulta (DISTINCT ON). */
  private async estadoAtualPorMotorista(
    grupoId: string,
  ): Promise<LinhaEstadoAtual[]> {
    return this.prisma.$queryRaw<LinhaEstadoAtual[]>(Prisma.sql`
      SELECT DISTINCT ON (r."motoristaId")
        r."motoristaId" AS "motoristaId",
        m.nome AS nome,
        r."tipoEvento"::text AS "tipoEvento",
        r."timestampEvento" AS "timestampEvento"
      FROM registros_jornada r
      JOIN motoristas m ON m.id = r."motoristaId"
      JOIN empresas emp ON emp.id = m."empresaId"
      WHERE emp."grupoId" = ${grupoId} AND m.status = ${StatusMotorista.ATIVO}::"StatusMotorista" AND r."tipoEvento" != 'OUTRO'
      ORDER BY r."motoristaId", r."timestampEvento" DESC, r.sequencial DESC
    `);
  }

  /**
   * Pra cada motorista cujo evento relevante mais recente NÃO é
   * FIM_JORNADA (ou seja, a jornada segue aberta), acha o INICIO_JORNADA
   * que abriu essa jornada , pra medir há quanto tempo está aberta.
   */
  private async jornadasEmAbertoComInicio(
    grupoId: string,
  ): Promise<{ motoristaId: string; nome: string; inicioJornada: Date }[]> {
    return this.prisma.$queryRaw<
      { motoristaId: string; nome: string; inicioJornada: Date }[]
    >(Prisma.sql`
      WITH ultimo_relevante AS (
        SELECT DISTINCT ON (r."motoristaId")
          r."motoristaId", r."tipoEvento", r.sequencial
        FROM registros_jornada r
        JOIN motoristas m ON m.id = r."motoristaId"
        JOIN empresas emp ON emp.id = m."empresaId"
        WHERE emp."grupoId" = ${grupoId} AND m.status = ${StatusMotorista.ATIVO}::"StatusMotorista" AND r."tipoEvento" != 'OUTRO'
        ORDER BY r."motoristaId", r."timestampEvento" DESC, r.sequencial DESC
      ),
      ultimo_inicio_jornada AS (
        SELECT DISTINCT ON (r."motoristaId")
          r."motoristaId", r."timestampEvento" AS "inicioJornada"
        FROM registros_jornada r
        WHERE r."tipoEvento" = 'INICIO_JORNADA'
        ORDER BY r."motoristaId", r."timestampEvento" DESC, r.sequencial DESC
      )
      SELECT m.id AS "motoristaId", m.nome AS nome, uij."inicioJornada" AS "inicioJornada"
      FROM ultimo_relevante ur
      JOIN motoristas m ON m.id = ur."motoristaId"
      JOIN ultimo_inicio_jornada uij ON uij."motoristaId" = ur."motoristaId"
      WHERE ur."tipoEvento" != 'FIM_JORNADA'
    `);
  }

  /**
   * Rodada 159: minutos de direção contínua (desde a última pausa de
   * descanso de 30min+ da jornada corrente) de cada motorista, mesma
   * regra de `JornadaLegalService.calcularAcumuladosDirecao`.
   */
  private async direcaoContinuaPorMotorista(
    motoristaIds: string[],
    agora: Date,
  ): Promise<Map<string, number>> {
    const resultado = new Map<string, number>();
    if (motoristaIds.length === 0) return resultado;

    const eventos = await this.prisma.registroJornada.findMany({
      where: { motoristaId: { in: motoristaIds } },
      select: { motoristaId: true, tipoEvento: true, timestampEvento: true },
      orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
    });
    const porMotorista = new Map<string, typeof eventos>();
    for (const e of eventos) {
      const lista = porMotorista.get(e.motoristaId) ?? [];
      lista.push(e);
      porMotorista.set(e.motoristaId, lista);
    }

    const PAUSA_QUALIFICADA_MS = 30 * 60000;
    for (const [motoristaId, todos] of porMotorista) {
      let idxInicio = 0;
      for (let i = todos.length - 1; i >= 0; i--) {
        if (todos[i].tipoEvento === 'INICIO_JORNADA') {
          idxInicio = i;
          break;
        }
      }
      const jornada = todos.slice(idxInicio);
      const intervalos = (tipoInicio: string, tipoFim: string) => {
        const lista: Array<{ inicio: number; fim: number }> = [];
        let aberto: number | null = null;
        for (const r of jornada) {
          if (r.tipoEvento === tipoInicio) aberto = r.timestampEvento.getTime();
          else if (r.tipoEvento === tipoFim && aberto !== null) {
            lista.push({ inicio: aberto, fim: r.timestampEvento.getTime() });
            aberto = null;
          }
        }
        if (aberto !== null) lista.push({ inicio: aberto, fim: agora.getTime() });
        return lista;
      };
      const direcao = intervalos('INICIO_DIRECAO', 'FIM_DIRECAO');
      const pausas = intervalos('INICIO_DESCANSO', 'FIM_DESCANSO')
        .filter((p) => p.fim - p.inicio >= PAUSA_QUALIFICADA_MS)
        .sort((a, b) => b.fim - a.fim);
      const corte = pausas[0]?.fim ?? jornada[0].timestampEvento.getTime();
      const ms = direcao
        .filter((i) => i.fim > corte)
        .reduce((acc, i) => acc + (i.fim - Math.max(i.inicio, corte)), 0);
      resultado.set(motoristaId, ms / 60000);
    }
    return resultado;
  }

  /** Texto do indicador "Motoristas em direção": tempo contínuo + faixa (limites 5h atenção, 5h30 crítico/excedido). */
  private descreverDirecaoContinua(minutos: number): string {
    const tempo = this.formatarHorasMinutos(minutos);
    if (minutos >= 330) {
      return `Direção contínua há ${tempo} · CRÍTICO: limite de 05:30 excedido em ${this.formatarHorasMinutos(minutos - 330)}`;
    }
    if (minutos >= 300) {
      return `Direção contínua há ${tempo} · ATENÇÃO: faltam ${this.formatarHorasMinutos(330 - minutos)} para o limite de 05:30`;
    }
    return `Direção contínua há ${tempo} · Normal (atenção a partir de 05:00)`;
  }

  /** "70" -> "01:10". Mesmo padrão de formatação de duração já usado em JornadaLegalService.formatarHoras , nunca minutos crus nas mensagens exibidas. */
  private formatarHorasMinutos(minutos: number): string {
    const totalMin = Math.max(0, Math.round(minutos));
    // Rodada 159: abaixo de 1h só o número de minutos ("55 m").
    if (totalMin < 60) return `${totalMin} m`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} h`;
  }
}
