import { TipoEvento } from '@prisma/client';

/**
 * Rodada 139 , pedido do usuário: um tratamento de ponto precisa ser
 * AMARRADO A UMA JORNADA. Quando o motorista bateu algum ponto na
 * jornada, o tratamento só pode corrigir aquele caso isolado (ex.:
 * fechar a direção que ficou aberta), encaixando-se na sequência já
 * existente. Quando não existe jornada naquele horário (nenhum
 * registro), o gestor precisa lançar a jornada inteira, começando por
 * "Início de jornada", na ordem.
 *
 * Mesma máquina de estados do app (mobile/src/domain/regrasJornada.ts)
 * , o que o app deixaria o motorista bater, o gestor também pode
 * lançar; o que o app bloquearia, o gestor também não pode.
 */
const PROXIMOS_POR_ULTIMO: Record<TipoEvento, TipoEvento[]> = {
  INICIO_JORNADA: [
    'INICIO_DIRECAO',
    'INICIO_DESCANSO',
    'ESPERA_CARGA_DESCARGA',
    'OUTRO',
    'FIM_JORNADA',
  ],
  FIM_DIRECAO: [
    'INICIO_DIRECAO',
    'INICIO_DESCANSO',
    'ESPERA_CARGA_DESCARGA',
    'OUTRO',
    'FIM_JORNADA',
  ],
  FIM_DESCANSO: [
    'INICIO_DIRECAO',
    'INICIO_DESCANSO',
    'ESPERA_CARGA_DESCARGA',
    'OUTRO',
    'FIM_JORNADA',
  ],
  FIM_ESPERA_CARGA_DESCARGA: [
    'INICIO_DIRECAO',
    'INICIO_DESCANSO',
    'ESPERA_CARGA_DESCARGA',
    'OUTRO',
    'FIM_JORNADA',
  ],
  FIM_DESCARREGAMENTO: [
    'INICIO_DIRECAO',
    'INICIO_DESCANSO',
    'ESPERA_CARGA_DESCARGA',
    'OUTRO',
    'FIM_JORNADA',
  ],
  INICIO_DIRECAO: ['FIM_DIRECAO'],
  INICIO_DESCANSO: ['FIM_DESCANSO'],
  ESPERA_CARGA_DESCARGA: ['FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO'],
  FIM_JORNADA: ['INICIO_JORNADA'],
  OUTRO: [
    'INICIO_DIRECAO',
    'INICIO_DESCANSO',
    'ESPERA_CARGA_DESCARGA',
    'FIM_JORNADA',
  ],
};

const ABRE_TRECHO: TipoEvento[] = [
  'INICIO_DIRECAO',
  'INICIO_DESCANSO',
  'ESPERA_CARGA_DESCARGA',
];

const ROTULO: Record<TipoEvento, string> = {
  INICIO_JORNADA: 'Início de jornada',
  FIM_JORNADA: 'Fim de jornada',
  INICIO_DIRECAO: 'Início de direção',
  FIM_DIRECAO: 'Fim de direção',
  INICIO_DESCANSO: 'Início de descanso',
  FIM_DESCANSO: 'Fim de descanso',
  ESPERA_CARGA_DESCARGA: 'Início de espera (carga/descarga)',
  FIM_ESPERA_CARGA_DESCARGA: 'Fim de espera (carga/descarga)',
  FIM_DESCARREGAMENTO: 'Fim de descarregamento',
  OUTRO: 'Aguardando documentação',
};

export interface EventoLinhaDoTempo {
  tipoEvento: TipoEvento;
  timestampEvento: Date;
}

export interface ResultadoValidacaoAjuste {
  ok: boolean;
  /** Mensagem pronta pro gestor (só quando `ok` é falso). */
  mensagem?: string;
  /** Tipos que o gestor PODE lançar nesse horário. */
  permitidos: TipoEvento[];
}

/**
 * @param anteriores eventos (registros reais + ajustes já lançados) com
 *   horário <= o do ajuste, em ordem cronológica.
 * @param posteriores eventos com horário > o do ajuste, em ordem
 *   cronológica.
 */
export function validarSequenciaAjuste(
  tipo: TipoEvento,
  anteriores: EventoLinhaDoTempo[],
  posteriores: EventoLinhaDoTempo[],
): ResultadoValidacaoAjuste {
  const ultimo = anteriores.length
    ? anteriores[anteriores.length - 1].tipoEvento
    : null;
  const proximo = posteriores.length ? posteriores[0].tipoEvento : null;

  // Sem jornada aberta nesse horário (nenhum registro, ou a última foi
  // encerrada): a única coisa que cabe é começar uma jornada.
  const permitidos: TipoEvento[] =
    ultimo === null ? ['INICIO_JORNADA'] : PROXIMOS_POR_ULTIMO[ultimo];

  if (!permitidos.includes(tipo)) {
    const lista = permitidos.map((t) => `"${ROTULO[t]}"`).join(', ');
    if (ultimo === null || ultimo === 'FIM_JORNADA') {
      return {
        ok: false,
        permitidos,
        mensagem: `Não há jornada aberta neste horário. Quando o motorista não tem nenhum registro, lance a jornada inteira em ordem, começando por "Início de jornada" (permitido agora: ${lista}).`,
      };
    }
    return {
      ok: false,
      permitidos,
      mensagem: `Neste horário o último registro do motorista é "${ROTULO[ultimo]}", então "${ROTULO[tipo]}" não encaixa na jornada. Permitido agora: ${lista}.`,
    };
  }

  // O ajuste também não pode deixar o que vem DEPOIS sem sentido (ex.:
  // lançar "Fim de direção" antes de um "Fim de direção" que o
  // motorista já bateu). Um "Início de jornada" logo depois é aceito:
  // só significa que a jornada seguinte já começou e a atual precisa
  // ser fechada pelo gestor.
  //
  // Rodada 155: um evento que ABRE um trecho (início de direção/descanso/
  // espera) lançado num intervalo vago não precisa "encaixar" no próximo
  // ponto do motorista: o gestor ainda vai lançar o evento que o fecha
  // (que só passa a ser permitido DEPOIS de o de abertura existir). Antes,
  // preencher um intervalo vago com um par início/fim era impossível (o
  // início era recusado pelo ponto seguinte, e o fim pelo ponto anterior).
  if (
    proximo !== null &&
    proximo !== 'INICIO_JORNADA' &&
    !ABRE_TRECHO.includes(tipo) &&
    !PROXIMOS_POR_ULTIMO[tipo].includes(proximo)
  ) {
    return {
      ok: false,
      permitidos,
      mensagem: `Depois deste horário o motorista já tem "${ROTULO[proximo]}" registrado, que não encaixa depois de "${ROTULO[tipo]}". Revise o horário do ajuste.`,
    };
  }

  return { ok: true, permitidos };
}
