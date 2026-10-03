import { RegistroJornada } from '@prisma/client';

/**
 * Compara dois registros de jornada pela ORDEM REAL EM QUE
 * ACONTECERAM , `timestampEvento`, capturado no próprio aparelho no
 * momento do toque (inclusive offline) , nunca por `sequencial`
 * sozinho, que é a ordem de CHEGADA ao servidor (decisão deliberada da
 * Rodada 7: `sequencial` segue sendo o critério certo para a cadeia de
 * hash em si , ver RegistrosJornadaService.create/verificarIntegridade
 * , mas NUNCA para decidir "o que aconteceu antes de quê").
 *
 * As duas ordens divergem sempre que a fila offline do app sincroniza
 * fora de ordem (ex.: um evento mais antigo chega ao backend DEPOIS de
 * um mais novo, por causa de retry de rede/reordenação da fila local).
 * Quando isso acontece, um registro cronologicamente mais antigo pode
 * receber um `sequencial` MAIOR que um mais novo , usar `sequencial`
 * para achar "o registro anterior" nesses casos produz falsos
 * positivos no motor de fraude (velocidade impossível, ritmo de
 * batidas suspeito, odômetro regressivo) e no motor de limites legais
 * (ociosidade de direção suspeita, recorte da jornada corrente).
 * Corrigido na Rodada 24 , ver
 * claude/arquitetura-seguranca-controle-jornada.md.
 *
 * `sequencial` só entra aqui como desempate de registros com o
 * EXATO mesmo `timestampEvento` (mesmo milissegundo).
 */
export function compararPorTimestampEvento(
  a: RegistroJornada,
  b: RegistroJornada,
): number {
  const diff = a.timestampEvento.getTime() - b.timestampEvento.getTime();
  if (diff !== 0) return diff;
  return a.sequencial - b.sequencial;
}
