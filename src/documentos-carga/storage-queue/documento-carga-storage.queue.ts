export const FILA_ARMAZENAMENTO_DOCUMENTOS_CARGA =
  'armazenamento-documentos-carga';

export interface JobRetentarUploadR2 {
  documentoId: string;
  chave: string;
  /** Buffer serializado em base64 , jobs do BullMQ são JSON, não aceitam Buffer direto. */
  conteudoBase64: string;
}
