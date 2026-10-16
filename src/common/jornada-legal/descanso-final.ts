/**
 * Rodada 265: início do descanso que fecha uma jornada.
 *
 * O motorista costuma registrar "Início de descanso", dormir e só depois
 * registrar "Fim de descanso" e "Fim de jornada". Medir o descanso entre
 * jornadas a partir do "Fim de jornada" jogava fora as horas dormidas e
 * juntava jornadas de dias diferentes (alerta de 8h de direção falso).
 * Aqui o descanso começa no INICIO_DESCANSO mais antigo da sequência
 * contínua de descansos que termina no FIM_JORNADA do índice `idxFim`.
 */
export function inicioDoDescansoFinal(
  ordenados: { tipoEvento: string; timestampEvento: Date }[],
  idxFim: number,
): Date {
  let inicio = ordenados[idxFim].timestampEvento;
  let i = idxFim - 1;
  while (
    i >= 1 &&
    ordenados[i].tipoEvento === 'FIM_DESCANSO' &&
    ordenados[i - 1].tipoEvento === 'INICIO_DESCANSO'
  ) {
    inicio = ordenados[i - 1].timestampEvento;
    i -= 2;
  }
  return inicio;
}
