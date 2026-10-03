/** Nome da fila BullMQ , ver `VerificacaoJornadaAgendadaService`/`Processor` (Rodada 21). */
export const FILA_VERIFICACAO_JORNADA = 'verificacao-jornada-agendada';

export interface JobVerificacaoJornada {
  motoristaId: string;
}
