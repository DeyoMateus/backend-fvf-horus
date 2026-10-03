-- Torna xmlOriginal opcional (o XML pode passar a viver no Cloudflare R2
-- em vez do Postgres) e adiciona a chave do objeto no bucket.
ALTER TABLE "documentos_carga" ALTER COLUMN "xmlOriginal" DROP NOT NULL;
ALTER TABLE "documentos_carga" ADD COLUMN "xmlStorageKey" TEXT;
