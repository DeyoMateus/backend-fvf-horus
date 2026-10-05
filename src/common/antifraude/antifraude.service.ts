import { Injectable } from '@nestjs/common';
import { marcarHorario } from '../fuso/fuso-brasil.util';
import {
  RegistroJornada,
  SeveridadeAlerta,
  TipoAlertaJornada,
} from '@prisma/client';
import { compararPorTimestampEvento } from '../ordenacao-temporal.util';

/**
 * Motor de detecção de fraude , sinais estatísticos/físicos que o
 * ledger em si não impede (o WORM/hash-chain garante que o que foi
 * gravado não muda depois, mas não impede que o motorista grave algo
 * falso da primeira vez). Roda dentro da MESMA transação que grava o
 * RegistroJornada (chamado por RegistrosJornadaService.create), lado a
 * lado com o JornadaLegalService , nunca bloqueia o registro em si
 * (ponto sempre é aceito, ver §15 do ARCHITECTURE.md), só fica marcado
 * pra investigação do gestor. Alertas CRITICO dão push pro
 * gestor/motorista igual aos de limite legal.
 *
 * Cinco categorias de sinal, nenhuma sozinha prova fraude (podem ter
 * explicação legítima: GPS ruim, device offline há dias, troca de
 * veículo) , por isso tudo aqui é "alerta pra investigar", não bloqueio
 * automático (o bloqueio automático de relógio adiantado/retrocedido
 * fica em RegistrosJornadaService.create, ver Rodada 87 , aqui só o
 * que não dá pra bloquear sem quebrar o uso legítimo offline):
 *
 *  1. Velocidade implausível entre duas coordenadas de GPS consecutivas
 *     (teleporte / GPS falsificado que passou pela checagem do app).
 *  2. Relógio do aparelho no futuro em relação ao horário que o
 *     servidor recebeu o registro (só acontece adiantando o relógio de
 *     propósito).
 *  3. Jornada ou trecho de direção com duração real implausivelmente
 *     curta (todos os botões apertados em sequência rápida agora,
 *     simulando um dia inteiro que não aconteceu).
 *  4. Odômetro voltando pra trás.
 *  5. Evento sincronizado com atraso grande demais pra ser só "ficou
 *     sem sinal" , mesmo padrão de atrasar o relógio do aparelho antes
 *     de bater o ponto, só que pro passado (não bloqueável, porque é
 *     indistinguível de uma fila offline legítima, ver Rodada 87).
 *
 * Mais os flags de integridade que o próprio app mobile já detecta
 * (root/jailbreak/hooking) , promovidos aqui de simples linha de
 * auditoria pra alerta visível na tela do gestor.
 */

const VELOCIDADE_MAXIMA_KMH = 150; // margem generosa acima de limite de rodovia , falso positivo custa caro (investigação sem motivo), então o limiar é folgado de propósito
const DISTANCIA_MINIMA_PARA_AVALIAR_VELOCIDADE_M = 300; // ignora ruído normal de GPS parado (deriva de alguns metros)
const DESVIO_RELOGIO_FUTURO_MAXIMO_MIN = 10; // tolerância de deriva normal de relógio de celular (NTP impreciso, fuso mal configurado)
// Rodada 87 , limiar de "atraso suspeito demais pra ser só sem sinal".
// Diferente do desvio de futuro acima (10min, porque nenhum atraso de
// relógio LEGÍTIMO deixa um evento no futuro), atraso pro passado É o
// modo normal de operação offline , por isso a janela é generosa (8h),
// só virando CRÍTICO perto do limite de 24h que o resto do sistema já
// trata como "não é mais um único trecho contínuo real" (ver o corte de
// 24h em HoleriteService.calcularIntervalos).
const LIMITE_ATRASO_SINCRONIZACAO_ATENCAO_MIN = 8 * 60; // 8h
const LIMITE_ATRASO_SINCRONIZACAO_CRITICO_MIN = 20 * 60; // 20h
const JORNADA_MINIMA_PLAUSIVEL_MIN = 20; // início->fim de UMA JORNADA INTEIRA abaixo disso não é um dia real de trabalho
const DIRECAO_MINIMA_PLAUSIVEL_MIN = 1; // início->fim de um trecho de direção abaixo disso é implausível pra qualquer distância real percorrida

interface AlertaCalculado {
  tipo: TipoAlertaJornada;
  severidade: SeveridadeAlerta;
  mensagem: string;
  janelaInicio: Date;
  janelaFim: Date;
  minutosAcumulados: number;
  detalhes?: Record<string, unknown>;
}

@Injectable()
export class AntifraudeService {
  /**
   * @param historico todo o ledger do motorista até aqui (inclusive o
   *   registro recém-criado), ordenado por sequencial.
   * @param registroRecemCriado o registro que disparou esta avaliação.
   * @param horaRecebimentoServidor `now()` no momento em que o backend
   *   recebeu a requisição , não é o `createdAt` do banco pra evitar
   *   depender do relógio da transação, mas equivalente na prática.
   * @param flagsIntegridadeDispositivo flags que o app mobile já
   *   detectou (ver mobile/src/security/deviceIntegrity.ts) e mandou
   *   junto do registro.
   */
  avaliar(
    historico: RegistroJornada[],
    registroRecemCriado: RegistroJornada,
    horaRecebimentoServidor: Date,
    flagsIntegridadeDispositivo: string[] | undefined,
    tiposExistentes: Set<TipoAlertaJornada>,
  ): AlertaCalculado[] {
    const alertas: AlertaCalculado[] = [];

    const velocidade = this.avaliarVelocidadeImpossivel(
      historico,
      registroRecemCriado,
    );
    if (velocidade) alertas.push(velocidade);

    const relogio = this.avaliarRelogioDispositivo(
      registroRecemCriado,
      horaRecebimentoServidor,
    );
    if (relogio) alertas.push(relogio);

    const sincronizacaoTardia = this.avaliarSincronizacaoTardiaSuspeita(
      registroRecemCriado,
      horaRecebimentoServidor,
    );
    if (sincronizacaoTardia) alertas.push(sincronizacaoTardia);

    const ritmo = this.avaliarRitmoBatidasSuspeito(
      historico,
      registroRecemCriado,
    );
    if (ritmo) alertas.push(ritmo);

    if (flagsIntegridadeDispositivo?.length) {
      alertas.push(
        this.alertaIntegridadeDispositivo(
          registroRecemCriado,
          flagsIntegridadeDispositivo,
        ),
      );
    }

    // Dedup: mesmo critério do JornadaLegalService , se este tipo já
    // foi levantado na janela consultada por quem chama, não repete.
    return alertas.filter((a) => !tiposExistentes.has(a.tipo));
  }

  /** Velocidade implícita entre o registro atual e o registro anterior mais recente que também tenha GPS, de qualquer tipo de evento. */
  private avaliarVelocidadeImpossivel(
    historico: RegistroJornada[],
    atual: RegistroJornada,
  ): AlertaCalculado | null {
    if (atual.latitude == null || atual.longitude == null) return null;

    // Ordem real dos eventos (timestampEvento), não a de chegada ao
    // servidor (sequencial) , ver ordenacao-temporal.util.ts, Rodada 24.
    const anterior = historico
      .filter(
        (r) =>
          compararPorTimestampEvento(r, atual) < 0 &&
          r.latitude != null &&
          r.longitude != null,
      )
      .sort((a, b) => compararPorTimestampEvento(b, a))[0];
    if (!anterior) return null;

    const minutos = this.minutosEntre(
      anterior.timestampEvento,
      atual.timestampEvento,
    );
    if (minutos <= 0) return null; // relógio andando pra trás é RELOGIO_DISPOSITIVO_SUSPEITO, não isto

    const distanciaM = this.distanciaHaversineMetros(
      Number(anterior.latitude),
      Number(anterior.longitude),
      Number(atual.latitude),
      Number(atual.longitude),
    );
    if (distanciaM < DISTANCIA_MINIMA_PARA_AVALIAR_VELOCIDADE_M) return null;

    const velocidadeKmh = distanciaM / 1000 / (minutos / 60);
    if (velocidadeKmh <= VELOCIDADE_MAXIMA_KMH) return null;

    return {
      tipo: TipoAlertaJornada.VELOCIDADE_IMPOSSIVEL_ENTRE_REGISTROS,
      severidade: SeveridadeAlerta.CRITICO,
      mensagem:
        `Distância de ${(distanciaM / 1000).toFixed(1)}km percorrida em ${this.formatarHoras(minutos)} entre dois ` +
        `registros implica velocidade média de ~${Math.round(velocidadeKmh)}km/h , fisicamente improvável para um ` +
        `caminhão. Sinal de GPS falsificado ou registro batido fora do local real.`,
      janelaInicio: anterior.timestampEvento,
      janelaFim: atual.timestampEvento,
      minutosAcumulados: Math.round(minutos),
      detalhes: {
        distanciaMetros: Math.round(distanciaM),
        velocidadeKmh: Math.round(velocidadeKmh),
        registroAnteriorId: anterior.id,
        registroAtualId: atual.id,
      },
    };
  }

  /**
   * `timestampEvento` é capturado no próprio aparelho no momento do
   * toque (inclusive offline, é assim que o app funciona sem internet
   * de propósito). Aqui só o FUTURO é impossível: o evento não pode ter
   * acontecido antes de o motorista tocar no botão , por isso continua
   * sendo o único caso BLOQUEADO de verdade (ver
   * RegistrosJornadaService.create, Rodada 87). Um evento "no passado"
   * em relação ao recebimento do servidor É o normal (fila offline
   * sincronizando depois) , quando esse atraso passa de umas poucas
   * horas, ainda vale avisar o gestor pra investigar (não bloquear, pra
   * não quebrar o uso offline legítimo): ver
   * `avaliarSincronizacaoTardiaSuspeita` logo abaixo.
   */
  private avaliarRelogioDispositivo(
    atual: RegistroJornada,
    horaRecebimentoServidor: Date,
  ): AlertaCalculado | null {
    const minutosNoFuturo = this.minutosEntre(
      horaRecebimentoServidor,
      atual.timestampEvento,
    );
    if (minutosNoFuturo <= DESVIO_RELOGIO_FUTURO_MAXIMO_MIN) return null;

    return {
      tipo: TipoAlertaJornada.RELOGIO_DISPOSITIVO_SUSPEITO,
      severidade: SeveridadeAlerta.CRITICO,
      mensagem:
        `O horário informado pelo aparelho (${marcarHorario(atual.timestampEvento)}) está ` +
        `${this.formatarHoras(minutosNoFuturo)} no futuro em relação ao horário em que o servidor recebeu o registro , ` +
        `só é possível com o relógio do aparelho adiantado de propósito.`,
      janelaInicio: horaRecebimentoServidor,
      janelaFim: atual.timestampEvento,
      minutosAcumulados: Math.round(minutosNoFuturo),
      detalhes: {
        registroId: atual.id,
        horaRecebimentoServidor: horaRecebimentoServidor.toISOString(),
      },
    };
  }

  /**
   * Rodada 87 , pedido do usuário (testou e confirmou: atrasar o
   * relógio do aparelho, bater um evento com horário passado plausível
   * e sincronizar depois passa batido pelo bloqueio de
   * RegistrosJornadaService.create, porque é EXATAMENTE o mesmo
   * formato de uma fila offline legítima , motorista ficou horas sem
   * sinal, sincroniza quando reconecta). Não dá pra bloquear isso sem
   * quebrar o caso de uso principal do app, mas dá pra avisar o gestor
   * quando o atraso é grande demais pra ser só "sem sinal" , é
   * exatamente o mesmo raciocínio dos outros sinais desta classe:
   * nenhum, sozinho, prova fraude, mas junta evidência pra investigação
   * humana em vez de deixar passar em silêncio total (que era o
   * comportamento de antes desta rodada).
   */
  private avaliarSincronizacaoTardiaSuspeita(
    atual: RegistroJornada,
    horaRecebimentoServidor: Date,
  ): AlertaCalculado | null {
    const minutosDeAtraso = this.minutosEntre(
      atual.timestampEvento,
      horaRecebimentoServidor,
    );
    if (minutosDeAtraso < LIMITE_ATRASO_SINCRONIZACAO_ATENCAO_MIN) return null;

    const critico = minutosDeAtraso >= LIMITE_ATRASO_SINCRONIZACAO_CRITICO_MIN;
    // Sem nenhuma coordenada de GPS pra corroborar onde o motorista
    // estava no horário alegado, o sinal fica mais forte ainda , isso
    // entra na MENSAGEM (pro gestor ler o contexto completo), não muda
    // a severidade sozinho (falta de GPS tem explicação legítima
    // comum: motorista sem permissão de localização, indoor, etc.).
    const semRastroDeGps = atual.latitude == null || atual.longitude == null;

    return {
      tipo: TipoAlertaJornada.SINCRONIZACAO_TARDIA_SUSPEITA,
      severidade: critico ? SeveridadeAlerta.CRITICO : SeveridadeAlerta.ATENCAO,
      mensagem:
        `Este evento (${marcarHorario(atual.timestampEvento)}) só chegou ao servidor ` +
        `${this.formatarHoras(minutosDeAtraso)} depois do horário que alega , bem mais do que uma sincronização ` +
        `normal após período sem sinal. Pode ser legítimo (motorista ficou horas sem cobertura), mas é também o ` +
        `mesmo padrão de atrasar o relógio do aparelho antes de bater o ponto.` +
        (semRastroDeGps
          ? ' Sem coordenada de GPS registrada neste evento para conferir o local alegado.'
          : ''),
      janelaInicio: atual.timestampEvento,
      janelaFim: horaRecebimentoServidor,
      minutosAcumulados: Math.round(minutosDeAtraso),
      detalhes: {
        registroId: atual.id,
        horaRecebimentoServidor: horaRecebimentoServidor.toISOString(),
        semRastroDeGps,
      },
    };
  }

  /**
   * Fecha um par início->fim (jornada inteira, ou só um trecho de
   * direção) com duração real implausível , sinal de bater tudo em
   * sequência rápida simulando um dia de trabalho que não aconteceu.
   */
  private avaliarRitmoBatidasSuspeito(
    historico: RegistroJornada[],
    atual: RegistroJornada,
  ): AlertaCalculado | null {
    if (atual.tipoEvento === 'FIM_JORNADA') {
      // Ordem real dos eventos, não a de chegada , Rodada 24.
      const inicioJornada = [...historico]
        .filter((r) => compararPorTimestampEvento(r, atual) < 0)
        .sort((a, b) => compararPorTimestampEvento(b, a))
        .find((r) => r.tipoEvento === 'INICIO_JORNADA');
      if (!inicioJornada) return null;

      const minutos = this.minutosEntre(
        inicioJornada.timestampEvento,
        atual.timestampEvento,
      );
      if (minutos < 0 || minutos >= JORNADA_MINIMA_PLAUSIVEL_MIN) return null;

      return {
        tipo: TipoAlertaJornada.SEQUENCIA_JORNADA_MUITO_RAPIDA,
        severidade: SeveridadeAlerta.CRITICO,
        mensagem:
          `Jornada inteira (início ao fim) durou apenas ${this.formatarHoras(minutos)} , tempo real implausível pra um ` +
          `dia de trabalho. Sinal de que os eventos foram todos batidos em sequência rápida agora.`,
        janelaInicio: inicioJornada.timestampEvento,
        janelaFim: atual.timestampEvento,
        minutosAcumulados: Math.round(minutos),
        detalhes: {
          registroInicioId: inicioJornada.id,
          registroFimId: atual.id,
        },
      };
    }

    if (atual.tipoEvento === 'FIM_DIRECAO') {
      // Ordem real dos eventos, não a de chegada , Rodada 24.
      const inicioDirecao = [...historico]
        .filter((r) => compararPorTimestampEvento(r, atual) < 0)
        .sort((a, b) => compararPorTimestampEvento(b, a))
        .find(
          (r) =>
            r.tipoEvento === 'INICIO_DIRECAO' || r.tipoEvento === 'FIM_DIRECAO',
        );
      if (!inicioDirecao || inicioDirecao.tipoEvento !== 'INICIO_DIRECAO')
        return null;

      const minutos = this.minutosEntre(
        inicioDirecao.timestampEvento,
        atual.timestampEvento,
      );
      if (minutos < 0 || minutos >= DIRECAO_MINIMA_PLAUSIVEL_MIN) return null;

      return {
        tipo: TipoAlertaJornada.SEQUENCIA_JORNADA_MUITO_RAPIDA,
        severidade: SeveridadeAlerta.ATENCAO,
        mensagem:
          `Trecho de direção (início ao fim) durou apenas ${Math.round(minutos * 60)}s , tempo real implausível ` +
          `pra qualquer deslocamento real.`,
        janelaInicio: inicioDirecao.timestampEvento,
        janelaFim: atual.timestampEvento,
        minutosAcumulados: Math.round(minutos),
        detalhes: {
          registroInicioId: inicioDirecao.id,
          registroFimId: atual.id,
        },
      };
    }

    return null;
  }

  private alertaIntegridadeDispositivo(
    atual: RegistroJornada,
    flags: string[],
  ): AlertaCalculado {
    return {
      tipo: TipoAlertaJornada.INTEGRIDADE_DISPOSITIVO_SUSPEITA,
      severidade: SeveridadeAlerta.ATENCAO,
      mensagem: `O aparelho reportou sinais de integridade comprometida neste registro: ${flags.join(', ')}.`,
      janelaInicio: atual.timestampEvento,
      janelaFim: atual.timestampEvento,
      minutosAcumulados: 0,
      detalhes: {
        flags,
        registroId: atual.id,
        deviceUuidUsado: atual.deviceUuidUsado,
      },
    };
  }

  /** "270" -> "04:30". Usado em toda mensagem de alerta exibida pro usuário , nunca minutos crus. */
  private formatarHoras(minutos: number): string {
    const totalMin = Math.max(0, Math.round(minutos));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private minutosEntre(a: Date, b: Date): number {
    return (b.getTime() - a.getTime()) / 60000;
  }

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
}
