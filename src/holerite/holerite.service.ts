import { ForbiddenException, Injectable } from '@nestjs/common';
import { StatusMotorista } from '@prisma/client';
import type {
  Motorista,
  RegistroJornada,
  TratamentoPonto,
} from '@prisma/client';
import type { EmpresaDoComprovante } from '../common/comprovante/comprovante.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';

// Mesmo limiar de "jornada de direção diária" já usado no motor de
// alertas (LIMITE_JORNADA_DIRECAO_ATENCAO_MIN em jornada-legal.service.ts)
// , 8h regulares, o que passar disso no dia é hora extra. Reaproveitado
// aqui como constante própria (não importado de lá) porque aquele valor
// é privado ao módulo de alertas e tem semântica de "limiar de aviso",
// não de "divisor normal/extra" , são usos diferentes do mesmo número
// legal, documentado de propósito pra não acoplar os dois módulos.
const LIMITE_JORNADA_NORMAL_DIARIA_MIN = 480; // 8h

// Adicional noturno (CLT art. 73): 22h de um dia às 5h do dia seguinte.
const ADICIONAL_NOTURNO_INICIO_HORA = 22;
const ADICIONAL_NOTURNO_FIM_HORA = 5;

type Categoria = 'DIRECAO' | 'ESPERA' | 'INDEFINIDO';

interface IntervaloCalculado {
  categoria: Categoria;
  inicio: Date;
  fim: Date;
  origemGestor: boolean;
  emAberto: boolean;
}

interface EventoUnificado {
  timestampEvento: Date;
  tipoEvento: string;
  origemGestor: boolean;
}

/**
 * Rodada 81 , pedido do usuário: o fechamento passou a trazer duas
 * partes. A primeira folha continua com os TOTAIS por dia (`dias`,
 * já existia); as folhas seguintes precisam listar, evento a evento,
 * exatamente quando o motorista bateu cada ponto (abertura/fechamento
 * de cada etapa) e o "status da ação" , daí os dois campos extras
 * aqui além do que `EventoUnificado` já tinha: `origemGestor` vira o
 * rótulo "Motorista"/"RH" na coluna Origem, e `detalhe` é o motivo (só
 * existe pra ajuste do RH) ou a observação (só existe se o motorista
 * escreveu uma ao bater o ponto) , nunca os dois ao mesmo tempo, já
 * que um evento só tem uma origem.
 */
export interface EventoDetalhadoHolerite {
  timestampEvento: Date;
  tipoEvento: string;
  origemGestor: boolean;
  detalhe: string | null;
  /// Rodada 98 , pedido do usuário: "coloque uma tabela de localização
  /// para cada lugar que o motorista bateu o ponto". Só existe pra
  /// eventos batidos pelo motorista (RegistroJornada tem GPS capturado
  /// no momento da batida); ajuste do gestor (TratamentoPonto) nunca
  /// tem coordenada própria , fica null, impresso como "," no PDF.
  latitude: number | null;
  longitude: number | null;
}

export interface DiaHolerite {
  dia: string; // YYYY-MM-DD
  direcaoMin: number;
  esperaMin: number;
  normalMin: number;
  extraMin: number;
  noturnoMin: number;
  /// Rodada 68 , jornada aberta sem etapa em aberto (nem direção, nem
  /// descanso, nem espera, nem "aguardando documentação"): o motorista
  /// bateu "Início de jornada" (ou fechou uma etapa) e não escolheu a
  /// próxima ação. Separado de propósito de direcaoMin/esperaMin , não
  /// é tempo trabalhado em nenhuma categoria, é tempo sem status.
  indefinidoMin: number;
  teveFechamentoGestor: boolean;
}

export interface OpcoesHolerite {
  direcaoEspera: boolean;
  normalExtra: boolean;
  adicionalNoturno: boolean;
}

export interface ResultadoHolerite {
  motoristaId: string;
  periodoInicio: Date;
  periodoFim: Date;
  opcoes: OpcoesHolerite;
  dias: DiaHolerite[];
  eventos: EventoDetalhadoHolerite[];
  totais: {
    direcaoMin: number;
    esperaMin: number;
    normalMin: number;
    extraMin: number;
    noturnoMin: number;
    indefinidoMin: number;
  };
  /// CCT/ACT usada pra decidir o limiar normal/extra do período , null
  /// quando o CNPJ do motorista não tem nenhuma regra sindical vinculada
  /// (cai no padrão legal geral, 8h/dia).
  regraSindicalAplicada: { id: string; nome: string } | null;
}

/**
 * Holerite (folha de ponto para pagamento): agrega, por dia, as horas de
 * direção/espera do ledger real do motorista JUNTO com os fechamentos
 * de ponto lançados pelo gestor (`TratamentoPonto`) no período , sem
 * isso, um dia em que o motorista esqueceu de bater o ponto e o gestor
 * fechou manualmente apareceria zerado no holerite, mesmo tendo
 * trabalhado (motivo de toda a Rodada 26: "para no final a empresa
 * conseguir tirar a folha de ponto e pagar corretamente").
 *
 * O gestor escolhe, a cada geração, quais das 3 categorias entram
 * (direção/espera, normal x extra, adicional noturno) , decisão do
 * usuário: cada empresa paga de um jeito diferente (fixo + comissão,
 * hora separada etc.), então os 3 recursos ficam sempre disponíveis e
 * quem decide o que aparecer no papel é quem gera.
 *
 * Período é sempre livre (o gestor escolhe as datas a cada geração, sem
 * "mês fechado" fixo no sistema).
 *
 * Limitação conhecida, documentada de propósito (mesmo nível de
 * simplicidade do resto do projeto , ver resumirJornadaDiaria em
 * RegistrosJornadaService): dia-calendário é sempre UTC, sem conversão
 * de fuso horário; um intervalo que começa fora do período informado
 * mas termina dentro dele não é contado (fica só o que abre e fecha, ou
 * fica em aberto, dentro da janela pedida).
 */
@Injectable()
export class HoleriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  async calcular(
    motoristaId: string,
    dataInicio: Date,
    dataFim: Date,
    opcoes: OpcoesHolerite,
    grupoIdSolicitante: string,
  ): Promise<ResultadoHolerite> {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );

    // Rodada 76 , BUG DE DADOS CORRIGIDO AQUI: o painel manda `fim` como
    // data de calendário pura (`<input type="date">` no `FechamentoModal`,
    // convertido com `new Date('2026-09-30').toISOString()`), o que dá
    // meia-noite UTC do dia escolhido , não o FIM daquele dia. Usado cru
    // como `lte` abaixo, isso cortava o dia inteiro de fechamento fora dos
    // totais (só o instante exato da meia-noite entraria), inclusive
    // qualquer `TratamentoPonto` que o RH lançasse justamente NO dia em
    // que está fechando o período , exatamente o caso mais comum de
    // "ajustei agora, na hora de fechar" desaparecer silenciosamente do
    // PDF extraído. `estenderParaFimDoDiaSeMeiaNoite` só mexe quando o
    // valor recebido é uma meia-noite exata (a assinatura de "só mandaram
    // um dia, sem hora"); um horário de corte específico passado por
    // outro chamador continua intocado.
    const dataFimEfetiva = this.estenderParaFimDoDiaSeMeiaNoite(dataFim);

    const motoristaComRegra = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      select: { empresa: { select: { regraSindical: true } } },
    });
    const regra = motoristaComRegra?.empresa.regraSindical ?? null;
    // Sem CCT/ACT cadastrada pro CNPJ deste motorista, cai no padrão
    // legal geral (CLT/Lei 13.103: 8h de jornada normal) , ver
    // RegraSindicalService/model no schema sobre por que isto não pode
    // ser hardcoded quando existe convenção coletiva vinculada.
    const limiteJornadaNormalMin =
      regra?.limiteJornadaNormalMin ?? LIMITE_JORNADA_NORMAL_DIARIA_MIN;

    const [registros, tratamentos] = await Promise.all([
      this.prisma.registroJornada.findMany({
        where: {
          motoristaId,
          timestampEvento: { gte: dataInicio, lte: dataFimEfetiva },
        },
        orderBy: { timestampEvento: 'asc' },
      }),
      this.prisma.tratamentoPonto.findMany({
        where: {
          motoristaId,
          timestampEvento: { gte: dataInicio, lte: dataFimEfetiva },
        },
        orderBy: { timestampEvento: 'asc' },
      }),
    ]);

    const eventos = this.unificarEventos(registros, tratamentos);
    const eventosDetalhados = this.construirEventosDetalhados(
      registros,
      tratamentos,
    );
    const intervalos = [
      ...this.calcularIntervalos(eventos, dataFimEfetiva),
      // Rodada 68 , cálculo aditivo, à parte: NUNCA reaproveita/altera
      // `calcularIntervalos` (direção/espera), que já tem cobertura de
      // teste específica para o corte de 24h e a exclusão de trechos em
      // aberto , só concatena os intervalos de tempo indefinido no
      // mesmo formato, pra `agruparPorDia` somar junto.
      ...this.calcularIntervalosIndefinido(eventos, dataFimEfetiva),
    ];
    const dias = this.agruparPorDia(intervalos, limiteJornadaNormalMin);

    const totais = dias.reduce(
      (acc, d) => ({
        direcaoMin: acc.direcaoMin + d.direcaoMin,
        esperaMin: acc.esperaMin + d.esperaMin,
        normalMin: acc.normalMin + d.normalMin,
        extraMin: acc.extraMin + d.extraMin,
        noturnoMin: acc.noturnoMin + d.noturnoMin,
        indefinidoMin: acc.indefinidoMin + d.indefinidoMin,
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

    return {
      motoristaId,
      periodoInicio: dataInicio,
      periodoFim: dataFim,
      opcoes,
      dias,
      eventos: eventosDetalhados,
      totais,
      regraSindicalAplicada: regra ? { id: regra.id, nome: regra.nome } : null,
    };
  }

  /**
   * Ver comentário em `calcular()` sobre por que isto existe: uma data
   * de calendário pura (meia-noite UTC exata) vira o FIM daquele dia
   * (23:59:59.999); qualquer outro horário passa direto.
   */
  private estenderParaFimDoDiaSeMeiaNoite(data: Date): Date {
    const eMeiaNoiteExata =
      data.getUTCHours() === 0 &&
      data.getUTCMinutes() === 0 &&
      data.getUTCSeconds() === 0 &&
      data.getUTCMilliseconds() === 0;
    if (!eMeiaNoiteExata) return data;
    return new Date(data.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  /**
   * Fechamento em lote (Rodada 36) , mesmo `calcular()` de sempre,
   * repetido por motorista (nunca duplica a lógica de cálculo), pra
   * dar suporte à "janela de fechamento" do gestor: fechar um
   * conjunto de motoristas (ou a frota inteira) de uma vez, em vez de
   * um PDF por vez. `motoristaIds` null/undefined = todos os
   * motoristas ATIVOS do grupo; uma lista = só esses (todos
   * conferidos contra o grupo do solicitante , um id de outro grupo
   * nunca é silenciosamente ignorado, é erro explícito).
   */
  async calcularEmLote(
    motoristaIds: string[] | null | undefined,
    dataInicio: Date,
    dataFim: Date,
    opcoes: OpcoesHolerite,
    grupoIdSolicitante: string,
  ): Promise<
    Array<{
      motorista: Pick<Motorista, 'id' | 'nome' | 'cpf' | 'cnh'>;
      empresa: EmpresaDoComprovante;
      resultado: ResultadoHolerite;
    }>
  > {
    const motoristas = await this.prisma.motorista.findMany({
      where: {
        empresa: { grupoId: grupoIdSolicitante },
        status: StatusMotorista.ATIVO,
        ...(motoristaIds && motoristaIds.length > 0
          ? { id: { in: motoristaIds } }
          : {}),
      },
      select: {
        id: true,
        nome: true,
        cpf: true,
        cnh: true,
        empresa: { select: { razaoSocial: true, cnpj: true } },
      },
      orderBy: { nome: 'asc' },
    });

    if (motoristaIds && motoristaIds.length > 0) {
      const encontrados = new Set(motoristas.map((m) => m.id));
      const faltando = motoristaIds.filter((id) => !encontrados.has(id));
      if (faltando.length > 0) {
        throw new ForbiddenException(
          'Um ou mais motoristas não pertencem ao seu grupo ou não estão ativos.',
        );
      }
    }

    const itens = [];
    for (const m of motoristas) {
      const resultado = await this.calcular(
        m.id,
        dataInicio,
        dataFim,
        opcoes,
        grupoIdSolicitante,
      );
      itens.push({ motorista: m, empresa: m.empresa, resultado });
    }
    return itens;
  }

  private unificarEventos(
    registros: RegistroJornada[],
    tratamentos: TratamentoPonto[],
  ): EventoUnificado[] {
    const eventos: EventoUnificado[] = [
      ...registros.map((r) => ({
        timestampEvento: r.timestampEvento,
        tipoEvento: r.tipoEvento,
        origemGestor: false,
      })),
      ...tratamentos.map((t) => ({
        timestampEvento: t.timestampEvento,
        tipoEvento: t.tipoEvento,
        origemGestor: true,
      })),
    ];
    eventos.sort(
      (a, b) => a.timestampEvento.getTime() - b.timestampEvento.getTime(),
    );
    return eventos;
  }

  /** Mesma fonte (`registros` + `tratamentos`) que `unificarEventos`, mas
   * preservando motivo/observação , usado só pra imprimir o log
   * detalhado no PDF (Rodada 81), nunca no cálculo de horas. */
  private construirEventosDetalhados(
    registros: RegistroJornada[],
    tratamentos: TratamentoPonto[],
  ): EventoDetalhadoHolerite[] {
    const eventos: EventoDetalhadoHolerite[] = [
      ...registros.map((r) => ({
        timestampEvento: r.timestampEvento,
        tipoEvento: r.tipoEvento,
        origemGestor: false,
        detalhe: r.observacao ?? null,
        latitude: r.latitude != null ? Number(r.latitude) : null,
        longitude: r.longitude != null ? Number(r.longitude) : null,
      })),
      ...tratamentos.map((t) => ({
        timestampEvento: t.timestampEvento,
        tipoEvento: t.tipoEvento,
        origemGestor: true,
        detalhe: t.motivo,
        latitude: null,
        longitude: null,
      })),
    ];
    eventos.sort(
      (a, b) => a.timestampEvento.getTime() - b.timestampEvento.getTime(),
    );
    return eventos;
  }

  /** Pareia INICIO_X → FIM_X pra virar intervalos, igual à lógica de somarIntervalosSimples de RegistrosJornadaService , mas aqui autocontido, porque também precisa considerar eventos de TratamentoPonto. */
  private calcularIntervalos(
    eventos: EventoUnificado[],
    fimAbertoFallback: Date,
  ): IntervaloCalculado[] {
    const intervalos: IntervaloCalculado[] = [];

    const pares: Array<{
      categoria: Categoria;
      inicio: string;
      fins: Set<string>;
    }> = [
      {
        categoria: 'DIRECAO',
        inicio: 'INICIO_DIRECAO',
        fins: new Set(['FIM_DIRECAO']),
      },
      {
        categoria: 'ESPERA',
        inicio: 'ESPERA_CARGA_DESCARGA',
        fins: new Set(['FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO']),
      },
    ];

    for (const par of pares) {
      let aberto: { inicio: Date; origemGestor: boolean } | null = null;
      for (const evento of eventos) {
        if (evento.tipoEvento === par.inicio) {
          aberto = {
            inicio: evento.timestampEvento,
            origemGestor: evento.origemGestor,
          };
        } else if (par.fins.has(evento.tipoEvento) && aberto) {
          intervalos.push({
            categoria: par.categoria,
            inicio: aberto.inicio,
            fim: evento.timestampEvento,
            origemGestor: aberto.origemGestor || evento.origemGestor,
            emAberto: false,
          });
          aberto = null;
        }
      }
      if (aberto) {
        // BUG DE DADOS CORRIGIDO AQUI: um "início" (INICIO_DIRECAO ou
        // ESPERA_CARGA_DESCARGA) sem o "fim" correspondente dentro do
        // período era estendido até `fimAbertoFallback` (fim do
        // período do relatório , "agora", pra fechamentos "mês
        // corrente até hoje") SEM LIMITE. Isso é correto pra um
        // trecho genuinamente em andamento NESTE INSTANTE, mas se o
        // motorista esqueceu de bater o "Fim" (comum em testes, e
        // possível na operação real também), o mesmo mecanismo conta
        // dias inteiros de "espera"/"direção" que nunca aconteceram ,
        // foi exatamente o que gerou "26:00" de espera num teste que
        // não chegou a esperar nem perto disso.
        //
        // Nenhum trecho contínuo de direção OU espera é legalmente
        // plausível além de 24h , o que passar disso quase certo é
        // início esquecido/sem fechamento, não tempo real. Por isso o
        // fim efetivo do trecho aberto é sempre o menor entre o fim do
        // período e "início + 24h", nunca deixando um único evento
        // esquecido inflar o relatório por dias.
        const limiteMaximoAberto = new Date(
          aberto.inicio.getTime() + 24 * 60 * 60 * 1000,
        );
        const fimEfetivo =
          fimAbertoFallback < limiteMaximoAberto
            ? fimAbertoFallback
            : limiteMaximoAberto;
        intervalos.push({
          categoria: par.categoria,
          inicio: aberto.inicio,
          fim: fimEfetivo,
          origemGestor: aberto.origemGestor,
          emAberto: true,
        });
      }
    }

    return intervalos;
  }

  /**
   * Rodada 68 , separado de `calcularIntervalos` de propósito (nunca
   * reaproveita nem altera aquele método, que só pareia
   * INICIO_X→FIM_X por categoria independente). Aqui é uma máquina de
   * estados de UMA passada só pelos eventos, porque "tempo indefinido"
   * depende do que veio ANTES (fecha ao entrar em qualquer etapa ,
   * direção, descanso, espera OU "aguardando documentação" , e reabre
   * ao fechar qualquer uma delas), não é um par fixo de tipos.
   *
   * "OUTRO" (aguardando documentação) fecha o tempo indefinido (o
   * motorista escolheu aquele status) mas não abre um novo intervalo ,
   * é uma etapa com nome próprio, sem "fim" explícito (ver
   * domain/regrasJornada.ts no app), e deliberadamente não entra em
   * nenhum total de horas (nem aqui, nem em direção/espera).
   *
   * Mesma regra de segurança do corte de 24h em `calcularIntervalos`:
   * um trecho indefinido em aberto no fim do período nunca se estende
   * além de `inicio + 24h`, e só é incluído nos totais quando fechado
   * (ver `agruparPorDia`, que já ignora `emAberto`).
   */
  private calcularIntervalosIndefinido(
    eventos: EventoUnificado[],
    fimAbertoFallback: Date,
  ): IntervaloCalculado[] {
    const ABRE_INDEFINIDO = new Set([
      'INICIO_JORNADA',
      'FIM_DIRECAO',
      'FIM_DESCANSO',
      'FIM_ESPERA_CARGA_DESCARGA',
      'FIM_DESCARREGAMENTO',
    ]);
    const FECHA_INDEFINIDO = new Set([
      'INICIO_DIRECAO',
      'INICIO_DESCANSO',
      'ESPERA_CARGA_DESCARGA',
      'OUTRO',
    ]);

    const intervalos: IntervaloCalculado[] = [];
    let aberto: { inicio: Date; origemGestor: boolean } | null = null;

    for (const evento of eventos) {
      if (ABRE_INDEFINIDO.has(evento.tipoEvento)) {
        aberto = {
          inicio: evento.timestampEvento,
          origemGestor: evento.origemGestor,
        };
      } else if (FECHA_INDEFINIDO.has(evento.tipoEvento) && aberto) {
        intervalos.push({
          categoria: 'INDEFINIDO',
          inicio: aberto.inicio,
          fim: evento.timestampEvento,
          origemGestor: aberto.origemGestor || evento.origemGestor,
          emAberto: false,
        });
        aberto = null;
      } else if (evento.tipoEvento === 'FIM_JORNADA') {
        // Fecha a jornada , se ainda havia tempo indefinido em aberto
        // (ex.: bateu "Início de jornada" e foi direto pro "Fim de
        // jornada"), fecha aqui igual a qualquer outro fim de etapa.
        if (aberto) {
          intervalos.push({
            categoria: 'INDEFINIDO',
            inicio: aberto.inicio,
            fim: evento.timestampEvento,
            origemGestor: aberto.origemGestor || evento.origemGestor,
            emAberto: false,
          });
        }
        aberto = null;
      }
    }

    if (aberto) {
      const limiteMaximoAberto = new Date(
        aberto.inicio.getTime() + 24 * 60 * 60 * 1000,
      );
      const fimEfetivo =
        fimAbertoFallback < limiteMaximoAberto
          ? fimAbertoFallback
          : limiteMaximoAberto;
      intervalos.push({
        categoria: 'INDEFINIDO',
        inicio: aberto.inicio,
        fim: fimEfetivo,
        origemGestor: aberto.origemGestor,
        emAberto: true,
      });
    }

    return intervalos;
  }

  private agruparPorDia(
    intervalos: IntervaloCalculado[],
    limiteJornadaNormalMin: number,
  ): DiaHolerite[] {
    const porDia = new Map<string, DiaHolerite>();
    const obterDia = (chave: string): DiaHolerite => {
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
          teveFechamentoGestor: false,
        };
        porDia.set(chave, d);
      }
      return d;
    };

    for (const intervalo of intervalos) {
      // BUG DE DADOS CORRIGIDO AQUI (2ª parte , a 1ª, limitar a 24h em
      // `calcularIntervalos`, não foi suficiente): um trecho "em
      // aberto" (sem o "fim" registrado dentro do período) não é um
      // dado VERIFICADO , é só um chute de que o motorista ainda
      // estaria esperando/dirigindo até o fim do período. Pra um
      // relatório de fechamento (que alimenta os cards do Indicadores
      // e o holerite), isso é sempre errado: ou o motorista esqueceu
      // de bater o fim (o caso mais comum, inclusive em teste), ou
      // ainda está em andamento e não deveria contar até fechar de
      // verdade. O fluxo correto pra "esqueceu de bater o fim" já
      // existe , o gestor fecha manualmente com um `TratamentoPonto`
      // (ver teste "inclui um fechamento de ponto do gestor") , então
      // um trecho em aberto simplesmente NÃO ENTRA nos totais até ser
      // fechado, por qualquer um dos dois jeitos.
      if (intervalo.emAberto) continue;

      for (const pedaco of this.dividirPorDiaCalendario(
        intervalo.inicio,
        intervalo.fim,
      )) {
        const chave = pedaco.inicio.toISOString().slice(0, 10);
        const dia = obterDia(chave);
        const minutos =
          (pedaco.fim.getTime() - pedaco.inicio.getTime()) / 60000;
        if (intervalo.categoria === 'DIRECAO') dia.direcaoMin += minutos;
        else if (intervalo.categoria === 'ESPERA') dia.esperaMin += minutos;
        else dia.indefinidoMin += minutos;
        // Tempo indefinido nunca é noturno "trabalhado" , adicional
        // noturno só faz sentido sobre direção de verdade.
        if (intervalo.categoria !== 'INDEFINIDO') {
          dia.noturnoMin += this.calcularMinutosNoturnos(
            pedaco.inicio,
            pedaco.fim,
          );
        }
        if (intervalo.origemGestor) dia.teveFechamentoGestor = true;
      }
    }

    for (const dia of porDia.values()) {
      dia.direcaoMin = Math.round(dia.direcaoMin);
      dia.esperaMin = Math.round(dia.esperaMin);
      dia.noturnoMin = Math.round(dia.noturnoMin);
      dia.indefinidoMin = Math.round(dia.indefinidoMin);
      dia.normalMin = Math.min(dia.direcaoMin, limiteJornadaNormalMin);
      dia.extraMin = Math.max(0, dia.direcaoMin - limiteJornadaNormalMin);
    }

    return Array.from(porDia.values()).sort((a, b) =>
      a.dia.localeCompare(b.dia),
    );
  }

  /** Quebra um intervalo em pedaços que não cruzam meia-noite (UTC), pra poder somar minutos por dia-calendário. */
  private dividirPorDiaCalendario(
    inicio: Date,
    fim: Date,
  ): Array<{ inicio: Date; fim: Date }> {
    const pedacos: Array<{ inicio: Date; fim: Date }> = [];
    let cursor = inicio;
    while (cursor < fim) {
      const proximaMeiaNoite = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate() + 1,
          0,
          0,
          0,
          0,
        ),
      );
      const fimDoPedaco = proximaMeiaNoite < fim ? proximaMeiaNoite : fim;
      pedacos.push({ inicio: cursor, fim: fimDoPedaco });
      cursor = fimDoPedaco;
    }
    return pedacos;
  }

  /** Minutos de um intervalo (já garantido dentro de um único dia-calendário) que caem na janela 22h–5h. */
  private calcularMinutosNoturnos(inicio: Date, fim: Date): number {
    const diaBase = Date.UTC(
      inicio.getUTCFullYear(),
      inicio.getUTCMonth(),
      inicio.getUTCDate(),
    );
    const janela1Inicio = diaBase + ADICIONAL_NOTURNO_INICIO_HORA * 3600_000;
    const janela1Fim = diaBase + 24 * 3600_000;
    const janela2Inicio = diaBase;
    const janela2Fim = diaBase + ADICIONAL_NOTURNO_FIM_HORA * 3600_000;

    const sobreposicao = (
      aIni: number,
      aFim: number,
      bIni: number,
      bFim: number,
    ) => Math.max(0, Math.min(aFim, bFim) - Math.max(aIni, bIni));

    const ini = inicio.getTime();
    const f = fim.getTime();
    const minutosNoturnos =
      sobreposicao(ini, f, janela1Inicio, janela1Fim) +
      sobreposicao(ini, f, janela2Inicio, janela2Fim);
    return minutosNoturnos / 60000;
  }
}
