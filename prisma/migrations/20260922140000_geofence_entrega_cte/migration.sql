ALTER TYPE "TipoAlertaJornada" ADD VALUE 'ENTREGA_FORA_DA_CERCA_VIRTUAL';

ALTER TABLE "documentos_carga" ADD COLUMN "enderecoDestinatario" TEXT;
ALTER TABLE "documentos_carga" ADD COLUMN "destinatarioLatitude" DECIMAL(10,7);
ALTER TABLE "documentos_carga" ADD COLUMN "destinatarioLongitude" DECIMAL(10,7);
ALTER TABLE "documentos_carga" ADD COLUMN "geocodificadoEm" TIMESTAMP(3);
