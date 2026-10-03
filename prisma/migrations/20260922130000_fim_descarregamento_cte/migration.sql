-- Novo tipo de evento: "Fim de descarregamento" , fecha uma espera de
-- carga/descarga igual FIM_ESPERA_CARGA_DESCARGA (conta pro mesmo
-- limite legal), mas sinaliza especificamente uma ENTREGA concluída.
ALTER TYPE "TipoEvento" ADD VALUE 'FIM_DESCARREGAMENTO';

-- Quando o vínculo motorista/CT-e foi "desfeito" (entrega concluída) ,
-- preenchido automaticamente pelo backend quando o motorista bate
-- "Fim de descarregamento". motoristaId permanece preenchido (histórico
-- de quem entregou); só statusCarga vira VAZIO.
ALTER TABLE "documentos_carga" ADD COLUMN "entregueEm" TIMESTAMP(3);
