import { CreateRegistroJornadaDto } from './dto/create-registro-jornada.dto';

/** Nome da fila BullMQ de processamento de lotes de ponto (Rodada 66). */
export const FILA_LOTE_REGISTROS_JORNADA = 'lote-registros-jornada';

export interface JobLoteRegistroJornada {
  motoristaId: string;
  deviceUuid: string;
  eventos: CreateRegistroJornadaDto[];
  ip?: string;
  userAgent?: string;
}

export interface ResultadoItemLote {
  index: number;
  sucesso: boolean;
  /** Id do RegistroJornada criado (ou já existente, se era um reenvio idempotente). */
  registroId?: string;
  erro?: string;
}
