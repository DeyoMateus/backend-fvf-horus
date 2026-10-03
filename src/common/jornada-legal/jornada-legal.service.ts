import { Injectable } from '@nestjs/common';
import {
  RegistroJornada,
  SeveridadeAlerta,
  TipoAlertaJornada,
  TipoEvento,
} from '@prisma/client';
import { compararPorTimestampEvento } from '../ordenacao-temporal.util';

/**
 * Motor de limites legais de jornada (Lei 13.103/2015 - "Lei do
 * Motorista") e de tempo de espera em carga/descarga.
 *
 * Regras aplicadas (resumo comercial → regra técnica):
 *  - Direção contínua: no máximo 5h30 (330min) sem uma pausa de pelo
 *    menos 30min (descanso ou refeição). Alerta de atenção aos 5h
 *    (300min), crítico aos 5h30.
 *  - Jornada de direção diária: 8h regular + até 2h extra = 10h
 *    (600min) máximo. Alerta de atenção às 8h (480min), crítico às 10h.
 *  - Espera em carga/descarga: alerta informativo às 3h (180min),
 *    atenção às 4h45 (285min) e, a partir de 5h (300min - limiar legal
 *    de "diária de espera"), crítico com os dados que alimentam o
 *    Dossiê de Cobrança (cobrança do tempo de espera ao contratante).
 *  - "Regra das 2 Conferências Consecutivas" (ociosidade suspeita em
 *    "Em Direção"): compara a coordenada de GPS de dois FIM_DIRECAO
 *    consecutivos da mesma jornada. Se passou tempo suficiente
 *    (≥20min) entre eles mas o deslocamento foi mínimo (≤500m, uma
 *    margem generosa pra derivas normais de GPS), levanta um alerta ,
 *    pode ser motor ligado parado no mesmo lugar, hodômetro batido por
 *    engano, ou GPS/registro fraudado. É uma aproximação honesta: o app
 *    hoje só captura GPS nos eventos discretos (início/fim de cada
 *    trecho), não faz amostragem periódica enquanto dirige , não é a
 *    "luneta" de conferência a cada hora prevista no material comercial
 *    (isso ainda não foi implementado, ver README do mobile).
 *
 * Roda dentro da MESMA transação que grava o RegistroJornada (chamado
 * pelo RegistrosJornadaService.create) para nunca avaliar um estado
 * inconsistente da cadeia. Só lê o ledger, nunca o altera , os alertas
 * são gravados numa tabela separada (não-WORM, operacional).
 */

interface Intervalo {
  inicio: Date;
  fim: Date;
}

interface AlertaCalculado {
  tipo: TipoAlertaJornada;
  severidade: SeveridadeAlerta;
  mensagem: string;
  janelaInicio: Date;
  janelaFim: Date;
  minutosAcumulados: number;
  detalhes?: Record<string, unknown>;
}

const LIMITE_DIRECAO_CONTINUA_ATENCAO_MIN = 300; // 5h
const LIMITE_DIRECAO_CONTINUA_CRITICO_MIN = 330; // 5h30
const LIMITE_JORNADA_DIRECAO_ATENCAO_MIN = 480; // 8h
const LIMITE_JORNADA_DIRECAO_CRITICO_MIN = 600; // 10h (8 regular + 2 extra)
const LIMITE_ESPERA_INFO_MIN = 180; // 3h
const LIMITE_ESPERA_ATENCAO_MIN = 285; // 4h45
const LIMITE_ESPERA_CRITICO_MIN = 300; // 5h (limiar legal de diária de espera)
const PAUSA_QUALIFICADA_MIN = 30;
const OCIOSIDADE_TEMPO_MINIMO_MIN = 20; // só avalia se passou tempo suficiente entre as duas conferências
const OCIOSIDADE_DISTANCIA_MAXIMA_M = 500; // margem generosa pra deriva normal de GPS

// Rodada 68 , pedido do usuário: "esse tempo em que o motorista
// iniciou a jornada mas não definiu que está dirigindo, aguardando
// algo... precisa ficar separado dos outros tempos" e "precisa
// direcionar o usuário a escolher alguma ação". Jornada aberta sem
// nenhuma etapa em aberto (nem direção, nem descanso, nem espera, nem
// "aguardando documentação") por tempo demais , o motorista bateu
// "Início de jornada" (ou fechou uma etapa) e não escolheu a próxima
// ação. Limiares deliberadamente curtos (minutos, não horas): ao
// contrário dos limites legais acima, aqui não existe uma lei sendo
// respeitada , é um problema de qualidade de dado/uso do app, então
// vale avisar rápido, antes que o motorista esqueça que a jornada já
// está contando.
const LIMITE_TEMPO_INDEFINIDO_ATENCAO_MIN = 15;
const LIMITE_TEMPO_INDEFINIDO_CRITICO_MIN = 30;

// Rodada 71 , pedido do usuário: a lei do motorista não impede o
// registro de outra jornada sem o descanso interjornada mínimo, mas
// tanto o gestor quanto o motorista precisam ser avisados quando isso
// acontece. Mesmo valor já usado (só informativamente, sem alerta) no
// relatório REP-P , ver RepPService.DESCANSO_INTERJORNADA_MINIMO_MIN.
const DESCANSO_INTERJORNADA_MINIMO_MIN = 660; // 11h (CLT art. 66 / Lei 13.103)

// Eventos que deixam a jornada sem nenhuma etapa em aberto , o
// cronômetro do app volta a contar "tempo indefinido" a partir de
// qualquer um destes (ver mobile/src/domain/regrasJornada.ts, mesma
// máquina de estados). "OUTRO" (aguardando documentação) fica de
// fora de propósito: é uma etapa com nome e orientação próprios,
// mesmo sem contar horas em nenhum relatório , o motorista ESCOLHEU
// aquele status, não é omissão.
const EVENTOS_ABERTURA_TEMPO_INDEFINIDO = new Set<TipoEvento>([
  TipoEvento.INICIO_JORNADA,
  TipoEvento.FIM_DIRECAO,
  TipoEvento.FIM_DESCANSO,
  TipoEvento.FIM_ESPERA_CARGA_DESCARGA,
  TipoEvento.FIM_DESCARREGAMENTO,
]);

@Injectable()
export class JornadaLegalService {
  /**
   * Avalia a jornada corrente do motorista (desde o último
   * INICIO_JORNADA, ou desde o início do histórico se não houver um) e
   * devolve os alertas que devem ser criados agora , já deduplicados
   * contra os `alertasExistentes` do mesmo tipo/janela.
   */
  avaliar(
    registros: RegistroJornada[],
    registroRecemCriado: RegistroJornada,
    alertasExistentesTipos: Set<TipoAlertaJornada>,
    /**
     * Normalmente omitido , "agora" é o horário do próprio evento que
     * acabou de disparar a avaliação (chamado dentro da transação de
     * `RegistrosJornadaService.create`). A verificação PROATIVA (Rodada
     * 19, `RegistrosJornadaService.verificarJornadasAbertasProativamente`)
     * passa o horário real da varredura aqui: sem isso, um motorista que
     * simplesmente não aperta mais nada no app (ex.: dirigindo
     * continuamente por horas sem registrar parada) nunca dispararia
     * nenhum alerta, porque este motor só era chamado quando um NOVO
     * evento era criado , sem evento novo, sem avaliação.
     */
    agoraOverride?: Date,
  ): AlertaCalculado[] {
    const agora = agoraOverride ?? registroRecemCriado.timestampEvento;
    const jornada = this.recortarJornadaCorrente(registros, agora);
    if (jornada.length === 0) return [];

    const janelaInicio = jornada[0].timestampEvento;
    const alertas: AlertaCalculado[] = [];

    // --- Direção ---
    const { direcaoContinuaMin, totalDirecaoMin, corteContinuo } =
      this.calcularAcumuladosDirecao(jornada, agora);

    if (
      direcaoContinuaMin >= LIMITE_DIRECAO_CONTINUA_CRITICO_MIN &&
      !alertasExistentesTipos.has(TipoAlertaJornada.DIRECAO_CONTINUA_EXCEDIDA)
    ) {
      alertas.push({
        tipo: TipoAlertaJornada.DIRECAO_CONTINUA_EXCEDIDA,
        severidade: SeveridadeAlerta.CRITICO,
        mensagem: `Direção contínua de ${this.formatarHoras(direcaoContinuaMin)} sem pausa qualificada (limite legal: 05:30).`,
        janelaInicio: corteContinuo,
        janelaFim: agora,
        minutosAcumulados: Math.round(direcaoContinuaMin),
      });
    } else if (
      direcaoContinuaMin >= LIMITE_DIRECAO_CONTINUA_ATENCAO_MIN &&
      !alertasExistentesTipos.has(
        TipoAlertaJornada.DIRECAO_CONTINUA_PROXIMA_LIMITE,
      ) &&
      !alertasExistentesTipos.has(TipoAlertaJornada.DIRECAO_CONTINUA_EXCEDIDA)
    ) {
      alertas.push({
        tipo: TipoAlertaJornada.DIRECAO_CONTINUA_PROXIMA_LIMITE,
        severidade: SeveridadeAlerta.ATENCAO,
        mensagem: `Direção contínua de ${this.formatarHoras(direcaoContinuaMin)} , aproximando do limite legal de 05:30 sem pausa.`,
        janelaInicio: corteContinuo,
        janelaFim: agora,
        minutosAcumulados: Math.round(direcaoContinuaMin),
      });
    }

    if (
      totalDirecaoMin >= LIMITE_JORNADA_DIRECAO_CRITICO_MIN &&
      !alertasExistentesTipos.has(TipoAlertaJornada.JORNADA_DIRECAO_EXCEDIDA)
    ) {
      alertas.push({
        tipo: TipoAlertaJornada.JORNADA_DIRECAO_EXCEDIDA,
        severidade: SeveridadeAlerta.CRITICO,
        mensagem: `Jornada de direção de ${this.formatarHoras(totalDirecaoMin)} no dia , excedeu o limite de 8h regulares + 2h extras (10:00).`,
        janelaInicio,
        janelaFim: agora,
        minutosAcumulados: Math.round(totalDirecaoMin),
      });
    } else if (
      totalDirecaoMin >= LIMITE_JORNADA_DIRECAO_ATENCAO_MIN &&
      !alertasExistentesTipos.has(
        TipoAlertaJornada.JORNADA_DIRECAO_PROXIMA_LIMITE,
      ) &&
      !alertasExistentesTipos.has(TipoAlertaJornada.JORNADA_DIRECAO_EXCEDIDA)
    ) {
      alertas.push({
        tipo: TipoAlertaJornada.JORNADA_DIRECAO_PROXIMA_LIMITE,
        severidade: SeveridadeAlerta.ATENCAO,
        mensagem: `Jornada de direção de ${this.formatarHoras(totalDirecaoMin)} no dia , aproximando do limite de 8h regulares (08:00).`,
        janelaInicio,
        janelaFim: agora,
        minutosAcumulados: Math.round(totalDirecaoMin),
      });
    }

    // --- Espera em carga/descarga ---
    // FIM_DESCARREGAMENTO fecha a espera igual FIM_ESPERA_CARGA_DESCARGA
    // (é a mesma espera legal , só sinaliza adicionalmente que foi uma
    // entrega, pro lado de DocumentosCarga). Ver Rodada 14.
    const esperaIntervalos = this.construirIntervalos(
      jornada,
      'ESPERA_CARGA_DESCARGA',
      ['FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO'],
      agora,
    );
    const totalEsperaMin = this.somarMinutos(esperaIntervalos);

    if (
      totalEsperaMin >= LIMITE_ESPERA_CRITICO_MIN &&
      !alertasExistentesTipos.has(
        TipoAlertaJornada.ESPERA_LIMITE_LEGAL_ATINGIDO,
      )
    ) {
      alertas.push({
        tipo: TipoAlertaJornada.ESPERA_LIMITE_LEGAL_ATINGIDO,
        severidade: SeveridadeAlerta.CRITICO,
        mensagem: `Tempo de espera em carga/descarga de ${this.formatarHoras(totalEsperaMin)} , atingiu o limiar legal de 05:00. Dossiê de cobrança disponível.`,
        janelaInicio,
        janelaFim: agora,
        minutosAcumulados: Math.round(totalEsperaMin),
        detalhes: {
          dossieDeCobranca: {
            motoristaId: registroRecemCriado.motoristaId,
            periodoInicio: janelaInicio.toISOString(),
            periodoFim: agora.toISOString(),
            minutosTotais: Math.round(totalEsperaMin),
            intervalos: esperaIntervalos.map((i) => ({
              inicio: i.inicio.toISOString(),
              fim: i.fim.toISOString(),
            })),
            registroGeradorId: registroRecemCriado.id,
            observacao:
              'Valor de referência do frete não configurado , preencher manualmente na conferência.',
          },
        },
      });
    } else if (
      totalEsperaMin >= LIMITE_ESPERA_ATENCAO_MIN &&
      !alertasExistentesTipos.has(TipoAlertaJornada.ESPERA_PROXIMA_LIMITE) &&
      !alertasExistentesTipos.has(
        TipoAlertaJornada.ESPERA_LIMITE_LEGAL_ATINGIDO,
      )
    ) {
      alertas.push({
        tipo: TipoAlertaJornada.ESPERA_PROXIMA_LIMITE,
        severidade: SeveridadeAlerta.ATENCAO,
        mensagem: `Tempo de espera em carga/descarga de ${this.formatarHoras(totalEsperaMin)} , próximo do limiar legal de 05:00.`,
        janelaInicio,
        janelaFim: agora,
        minutosAcumulados: Math.round(totalEsperaMin),
      });
    } else if (
      totalEsperaMin >= LIMITE_ESPERA_INFO_MIN &&
      !alertasExistentesTipos.has(TipoAlertaJornada.ESPERA_PROXIMA_LIMITE) &&
      !alertasExistentesTipos.has(
        TipoAlertaJornada.ESPERA_LIMITE_LEGAL_ATINGIDO,
      )
    ) {
      alertas.push({
        tipo: TipoAlertaJornada.ESPERA_PROXIMA_LIMITE,
        severidade: SeveridadeAlerta.INFO,
        mensagem: `Tempo de espera em carga/descarga de ${this.formatarHoras(totalEsperaMin)} já acumulado nesta jornada.`,
        janelaInicio,
        janelaFim: agora,
        minutosAcumulados: Math.round(totalEsperaMin),
      });
    }

    const ociosidade = this.avaliarOciosidadeDirecao(
      jornada,
      registroRecemCriado,
      alertasExistentesTipos,
    );
    if (ociosidade) alertas.push(ociosidade);

    const tempoIndefinido = this.avaliarTempoIndefinido(
      jornada,
      agora,
      alertasExistentesTipos,
    );
    if (tempoIndefinido) alertas.push(tempoIndefinido);

    const descansoInterjornada = this.avaliarDescansoInterjornada(
      registros,
      registroRecemCriado,
      alertasExistentesTipos,
    );
    if (descansoInterjornada) alertas.push(descansoInterjornada);

    return alertas;
  }

  /**
   * Rodada 21 , dado o estado atual do motorista, calcula em quanto
   * tempo (ms a partir de `agora`) ele cruzaria o PRÓXIMO limiar ainda
   * não atingido de direção contínua, jornada de direção total ou
   * espera , supondo que nenhum evento novo seja registrado até lá.
   *
   * É a peça que permite trocar "escanear todo mundo com jornada
   * aberta a cada N minutos" (Rodada 19/20) por "agendar um único job
   * futuro por motorista, exatamente na hora em que o próximo limiar
   * seria cruzado" (ver `VerificacaoJornadaAgendadaService`) , o custo
   * deixa de crescer com o número total de motoristas cadastrados e
   * passa a depender só de quantos estão com uma atividade em aberto
   * agora, cada um com no máximo um job pendente por vez.
   *
   * Só existe "próximo limiar" enquanto uma das três atividades está
   * de fato em aberto (o último evento relevante da jornada corrente é
   * INICIO_DIRECAO ou ESPERA_CARGA_DESCARGA) , se o motorista parou
   * (FIM_DIRECAO, início de descanso, etc.), esses acumulados ficam
   * congelados até o próximo evento, que já reavalia tudo pelo
   * caminho reativo normal (`RegistrosJornadaService.create`), então
   * não há nada a esperar sem um evento novo.
   *
   * Não recebe `alertasExistentesTipos`: um limiar só é proposto aqui
   * quando o acumulado atual ainda está ABAIXO dele , por construção,
   * isso já exclui qualquer limiar que tenha sido cruzado (e portanto
   * já alertado) antes, sem precisar reconferir contra a tabela de
   * alertas já criados.
   */
  calcularProximoLimiar(
    registros: RegistroJornada[],
    agora: Date,
  ): { emMs: number } | null {
    const jornada = this.recortarJornadaCorrente(registros, agora);
    if (jornada.length === 0) return null;

    const ultimoEvento = jornada[jornada.length - 1].tipoEvento;
    const candidatosMin: number[] = [];

    if (ultimoEvento === TipoEvento.INICIO_DIRECAO) {
      const { direcaoContinuaMin, totalDirecaoMin } =
        this.calcularAcumuladosDirecao(jornada, agora);
      for (const limite of [
        LIMITE_DIRECAO_CONTINUA_ATENCAO_MIN,
        LIMITE_DIRECAO_CONTINUA_CRITICO_MIN,
      ]) {
        if (direcaoContinuaMin < limite)
          candidatosMin.push(limite - direcaoContinuaMin);
      }
      for (const limite of [
        LIMITE_JORNADA_DIRECAO_ATENCAO_MIN,
        LIMITE_JORNADA_DIRECAO_CRITICO_MIN,
      ]) {
        if (totalDirecaoMin < limite)
          candidatosMin.push(limite - totalDirecaoMin);
      }
    } else if (ultimoEvento === TipoEvento.ESPERA_CARGA_DESCARGA) {
      const totalEsperaMin = this.somarMinutos(
        this.construirIntervalos(
          jornada,
          'ESPERA_CARGA_DESCARGA',
          ['FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO'],
          agora,
        ),
      );
      for (const limite of [
        LIMITE_ESPERA_INFO_MIN,
        LIMITE_ESPERA_ATENCAO_MIN,
        LIMITE_ESPERA_CRITICO_MIN,
      ]) {
        if (totalEsperaMin < limite)
          candidatosMin.push(limite - totalEsperaMin);
      }
    } else if (EVENTOS_ABERTURA_TEMPO_INDEFINIDO.has(ultimoEvento)) {
      // Rodada 68 , mesmo raciocínio dos outros dois ramos: só existe
      // "próximo limiar" de tempo indefinido enquanto a jornada
      // realmente está nesse estado agora (o último evento é um dos
      // que abrem tempo indefinido) , qualquer evento novo reavalia
      // tudo pelo caminho reativo normal.
      const desde = jornada[jornada.length - 1].timestampEvento;
      const minutosIndefinido = this.minutosEntre(desde, agora);
      for (const limite of [
        LIMITE_TEMPO_INDEFINIDO_ATENCAO_MIN,
        LIMITE_TEMPO_INDEFINIDO_CRITICO_MIN,
      ]) {
        if (minutosIndefinido < limite)
          candidatosMin.push(limite - minutosIndefinido);
      }
    }

    if (candidatosMin.length === 0) return null;
    const minMin = Math.min(...candidatosMin);
    return { emMs: Math.max(0, Math.round(minMin * 60000)) };
  }

  /**
   * "Regra das 2 Conferências Consecutivas" , ver comentário no topo do
   * arquivo. Só avalia quando o registro recém-criado é um FIM_DIRECAO
   * (é o momento em que temos uma nova "conferência" de coordenada pra
   * comparar com a anterior).
   */
  private avaliarOciosidadeDirecao(
    jornada: RegistroJornada[],
    registroRecemCriado: RegistroJornada,
    alertasExistentesTipos: Set<TipoAlertaJornada>,
  ): AlertaCalculado | null {
    if (registroRecemCriado.tipoEvento !== TipoEvento.FIM_DIRECAO) return null;
    if (
      alertasExistentesTipos.has(TipoAlertaJornada.OCIOSIDADE_DIRECAO_SUSPEITA)
    )
      return null;

    // Ordem real dos eventos (timestampEvento), não a de chegada ao
    // servidor (sequencial) , ver ordenacao-temporal.util.ts, Rodada 24.
    const conferencias = jornada
      .filter(
        (r) =>
          r.tipoEvento === TipoEvento.FIM_DIRECAO &&
          r.latitude != null &&
          r.longitude != null &&
          r.timestampEvento.getTime() <=
            registroRecemCriado.timestampEvento.getTime(),
      )
      .sort(compararPorTimestampEvento);

    if (conferencias.length < 2) return null;

    const atual = conferencias[conferencias.length - 1];
    const anterior = conferencias[conferencias.length - 2];

    const minutosEntreConferencias = this.minutosEntre(
      anterior.timestampEvento,
      atual.timestampEvento,
    );
    if (minutosEntreConferencias < OCIOSIDADE_TEMPO_MINIMO_MIN) return null;

    const distanciaM = this.distanciaHaversineMetros(
      Number(anterior.latitude),
      Number(anterior.longitude),
      Number(atual.latitude),
      Number(atual.longitude),
    );
    if (distanciaM > OCIOSIDADE_DISTANCIA_MAXIMA_M) return null;

    return {
      tipo: TipoAlertaJornada.OCIOSIDADE_DIRECAO_SUSPEITA,
      severidade: SeveridadeAlerta.ATENCAO,
      mensagem:
        `Deslocamento de apenas ${Math.round(distanciaM)}m em ${this.formatarHoras(minutosEntreConferencias)} entre duas ` +
        `conferências de GPS marcadas como "em direção" , vale conferir se o veículo estava realmente em movimento.`,
      janelaInicio: anterior.timestampEvento,
      janelaFim: atual.timestampEvento,
      minutosAcumulados: Math.round(minutosEntreConferencias),
      detalhes: {
        distanciaMetros: Math.round(distanciaM),
        registroAnteriorId: anterior.id,
        registroAtualId: atual.id,
      },
    };
  }

  /** Distância aproximada (fórmula de Haversine) entre duas coordenadas, em metros. */
  private distanciaHaversineMetros(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const RAIO_TERRA_M = 6371000;
    const toRad = (graus: number) => (graus * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return RAIO_TERRA_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Soma de direção total e de direção contínua (desde a última pausa
   * qualificada de 30min+) até `agora` , extraído de `avaliar()` pra
   * ser reaproveitado também por `calcularProximoLimiar` (Rodada 21),
   * sem duplicar a mesma conta em dois lugares.
   */
  private calcularAcumuladosDirecao(
    jornada: RegistroJornada[],
    agora: Date,
  ): {
    direcaoContinuaMin: number;
    totalDirecaoMin: number;
    corteContinuo: Date;
  } {
    const janelaInicio = jornada[0].timestampEvento;
    const direcaoIntervalos = this.construirIntervalos(
      jornada,
      'INICIO_DIRECAO',
      ['FIM_DIRECAO'],
      agora,
    );
    const totalDirecaoMin = this.somarMinutos(direcaoIntervalos);

    // INICIO_REFEICAO/FIM_REFEICAO existiu como tipo de evento separado,
    // mas foi removido do enum (refeição passou a ser registrada como
    // um descanso comum) , pausa qualificada agora é só descanso.
    const pausasQualificadas = this.construirIntervalos(
      jornada,
      'INICIO_DESCANSO',
      ['FIM_DESCANSO'],
      agora,
    )
      .filter(
        (p) => this.minutosEntre(p.inicio, p.fim) >= PAUSA_QUALIFICADA_MIN,
      )
      .sort((a, b) => b.fim.getTime() - a.fim.getTime());

    const corteContinuo = pausasQualificadas[0]?.fim ?? janelaInicio;
    const direcaoContinuaMin = this.somarMinutos(
      direcaoIntervalos
        .filter((i) => i.fim.getTime() > corteContinuo.getTime())
        .map((i) => ({
          inicio:
            i.inicio.getTime() > corteContinuo.getTime()
              ? i.inicio
              : corteContinuo,
          fim: i.fim,
        })),
    );

    return { direcaoContinuaMin, totalDirecaoMin, corteContinuo };
  }

  /**
   * Rodada 71 , pedido do usuário: "a lei prevê não deve impedir o
   * motorista de registrar o ponto... mas o gestor deve ser
   * notificado... assim como o motorista". Diferente dos outros
   * alertas deste arquivo (que acompanham um acumulado que cresce
   * enquanto uma etapa fica em aberto), este é uma verificação
   * PONTUAL, feita uma única vez no exato momento em que o motorista
   * bate um novo "Início de jornada": compara contra o "Fim de
   * jornada" imediatamente anterior no ledger (se houver) e, se o
   * intervalo entre os dois for menor que o mínimo legal de descanso
   * interjornada, gera um alerta CRÍTICO , mesma severidade dos
   * outros estouros legais deste motor, o que já é suficiente pra
   * disparar os dois canais existentes de notificação crítica (push
   * pro motorista, WhatsApp pros gestores da empresa, ver
   * RegistrosJornadaService.create). NUNCA bloqueia o registro em si
   * , só avisa; a tela de confirmação/explicação pro motorista fica
   * no app (RegistrarPontoScreen.tsx), não aqui.
   */
  private avaliarDescansoInterjornada(
    registros: RegistroJornada[],
    registroRecemCriado: RegistroJornada,
    alertasExistentesTipos: Set<TipoAlertaJornada>,
  ): AlertaCalculado | null {
    if (registroRecemCriado.tipoEvento !== TipoEvento.INICIO_JORNADA)
      return null;
    if (
      alertasExistentesTipos.has(
        TipoAlertaJornada.DESCANSO_INTERJORNADA_INSUFICIENTE,
      )
    )
      return null;

    const ordenados = [...registros].sort(compararPorTimestampEvento);
    const idxAtual = ordenados.findIndex(
      (r) => r.id === registroRecemCriado.id,
    );
    if (idxAtual <= 0) return null; // primeira jornada de todo o histórico , nada anterior pra comparar

    const anterior = ordenados[idxAtual - 1];
    // Se o evento imediatamente anterior não for um FIM_JORNADA, o
    // ledger está num estado que este motor não sabe interpretar
    // aqui (não deveria acontecer, dada a máquina de estados do app
    // , ver mobile/src/domain/regrasJornada.ts) , melhor não alertar
    // com dados que não fazem sentido do que arriscar um falso
    // positivo.
    if (anterior.tipoEvento !== TipoEvento.FIM_JORNADA) return null;

    const descansoMin = this.minutosEntre(
      anterior.timestampEvento,
      registroRecemCriado.timestampEvento,
    );
    if (descansoMin >= DESCANSO_INTERJORNADA_MINIMO_MIN) return null;

    // Pedido do usuário: "uma jornada pode ter mais de um dia, e o
    // mesmo dia pode ter mais de uma jornada... por acidente ele pode
    // finalizar a jornada antes do fim do dia e iniciar outra não tem
    // problema". A regra das 11h de descanso só vale quando a jornada
    // ANTERIOR já tinha cumprido o limite legal de horas de direção
    // (8h, podendo chegar a 10h com hora extra) , se não cumpriu,
    // essa "jornada anterior" ficou incompleta e a nova é só um
    // COMPLEMENTO dela (ex.: motorista fechou por engano e reabriu),
    // não uma jornada nova de verdade , não faz sentido exigir 11h de
    // descanso de uma jornada que nem chegou a terminar de verdade.
    const idxInicioJornadaAnterior = ordenados
      .slice(0, idxAtual - 1 + 1) // até o índice de `anterior`, inclusive
      .map((r) => r.tipoEvento)
      .lastIndexOf(TipoEvento.INICIO_JORNADA);
    if (idxInicioJornadaAnterior !== -1) {
      const jornadaAnterior = ordenados.slice(
        idxInicioJornadaAnterior,
        idxAtual, // até `anterior` (idxAtual - 1), exclusive de registroRecemCriado
      );
      const { totalDirecaoMin: direcaoJornadaAnteriorMin } =
        this.calcularAcumuladosDirecao(
          jornadaAnterior,
          anterior.timestampEvento,
        );
      if (direcaoJornadaAnteriorMin < LIMITE_JORNADA_DIRECAO_ATENCAO_MIN) {
        // Jornada anterior incompleta (menos de 8h de direção) , a
        // nova jornada é um complemento, não gera alerta de descanso
        // insuficiente, não importa quão pouco tempo passou.
        return null;
      }
    }

    const faltamMin = DESCANSO_INTERJORNADA_MINIMO_MIN - descansoMin;
    return {
      tipo: TipoAlertaJornada.DESCANSO_INTERJORNADA_INSUFICIENTE,
      severidade: SeveridadeAlerta.CRITICO,
      mensagem:
        `Nova jornada iniciada após apenas ${this.formatarHoras(descansoMin)} de descanso desde o fim da jornada ` +
        `anterior (que já tinha cumprido a jornada legal de direção) , abaixo do mínimo legal de 11:00 ` +
        `(faltam ${this.formatarHoras(faltamMin)}).`,
      janelaInicio: anterior.timestampEvento,
      janelaFim: registroRecemCriado.timestampEvento,
      minutosAcumulados: Math.round(descansoMin),
    };
  }

  /** Registros desde o último INICIO_JORNADA (inclusive), ou todo o histórico se não houver nenhum. */
  private recortarJornadaCorrente(
    registros: RegistroJornada[],
    agora: Date,
  ): RegistroJornada[] {
    // Ordem real dos eventos, não a de chegada ao servidor , Rodada 24.
    const ordenados = [...registros]
      .filter((r) => r.timestampEvento.getTime() <= agora.getTime())
      .sort(compararPorTimestampEvento);
    const ultimoInicioIdx = ordenados
      .map((r) => r.tipoEvento)
      .lastIndexOf(TipoEvento.INICIO_JORNADA);
    return ultimoInicioIdx === -1
      ? ordenados
      : ordenados.slice(ultimoInicioIdx);
  }

  private construirIntervalos(
    registros: RegistroJornada[],
    tipoInicio: keyof typeof TipoEvento,
    tiposFim: (keyof typeof TipoEvento)[],
    agora: Date,
  ): Intervalo[] {
    const valoresFim = new Set(tiposFim.map((t) => TipoEvento[t]));
    const intervalos: Intervalo[] = [];
    let aberto: Date | null = null;
    for (const r of registros) {
      if (r.tipoEvento === TipoEvento[tipoInicio]) {
        aberto = r.timestampEvento;
      } else if (valoresFim.has(r.tipoEvento) && aberto) {
        intervalos.push({ inicio: aberto, fim: r.timestampEvento });
        aberto = null;
      }
    }
    if (aberto) intervalos.push({ inicio: aberto, fim: agora });
    return intervalos;
  }

  /**
   * Rodada 68 , ver constantes/comentário no topo do arquivo. Só
   * avalia quando o último evento da jornada corrente é um dos que
   * deixam a jornada sem etapa em aberto (`EVENTOS_ABERTURA_TEMPO_INDEFINIDO`)
   * , se o motorista já está em direção/descanso/espera/aguardando
   * documentação, não há "tempo indefinido" correndo agora.
   */
  private avaliarTempoIndefinido(
    jornada: RegistroJornada[],
    agora: Date,
    alertasExistentesTipos: Set<TipoAlertaJornada>,
  ): AlertaCalculado | null {
    const ultimoRegistro = jornada[jornada.length - 1];
    if (!EVENTOS_ABERTURA_TEMPO_INDEFINIDO.has(ultimoRegistro.tipoEvento))
      return null;

    const minutosIndefinido = this.minutosEntre(
      ultimoRegistro.timestampEvento,
      agora,
    );

    if (
      minutosIndefinido >= LIMITE_TEMPO_INDEFINIDO_CRITICO_MIN &&
      !alertasExistentesTipos.has(TipoAlertaJornada.TEMPO_INDEFINIDO_PROLONGADO)
    ) {
      return {
        tipo: TipoAlertaJornada.TEMPO_INDEFINIDO_PROLONGADO,
        severidade: SeveridadeAlerta.CRITICO,
        mensagem: `Jornada aberta há ${this.formatarHoras(minutosIndefinido)} sem nenhuma etapa escolhida (direção, descanso ou espera) , esse tempo está contando como indefinido, não como trabalhado. Escolha uma ação no app.`,
        janelaInicio: ultimoRegistro.timestampEvento,
        janelaFim: agora,
        minutosAcumulados: Math.round(minutosIndefinido),
      };
    }
    if (
      minutosIndefinido >= LIMITE_TEMPO_INDEFINIDO_ATENCAO_MIN &&
      !alertasExistentesTipos.has(
        TipoAlertaJornada.TEMPO_INDEFINIDO_PROXIMO_LIMITE,
      ) &&
      !alertasExistentesTipos.has(TipoAlertaJornada.TEMPO_INDEFINIDO_PROLONGADO)
    ) {
      return {
        tipo: TipoAlertaJornada.TEMPO_INDEFINIDO_PROXIMO_LIMITE,
        severidade: SeveridadeAlerta.ATENCAO,
        mensagem: `Jornada aberta há ${this.formatarHoras(minutosIndefinido)} sem nenhuma etapa escolhida (direção, descanso ou espera) , esse tempo está contando como indefinido. Escolha uma ação no app.`,
        janelaInicio: ultimoRegistro.timestampEvento,
        janelaFim: agora,
        minutosAcumulados: Math.round(minutosIndefinido),
      };
    }
    return null;
  }

  private minutosEntre(inicio: Date, fim: Date): number {
    return (fim.getTime() - inicio.getTime()) / 60000;
  }

  /** "270" -> "04:30". Usado em toda mensagem de alerta exibida pro usuário , nunca minutos crus. */
  private formatarHoras(minutos: number): string {
    const totalMin = Math.max(0, Math.round(minutos));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private somarMinutos(intervalos: Intervalo[]): number {
    return intervalos.reduce(
      (acc, i) => acc + this.minutosEntre(i.inicio, i.fim),
      0,
    );
  }
}

export type { AlertaCalculado };
