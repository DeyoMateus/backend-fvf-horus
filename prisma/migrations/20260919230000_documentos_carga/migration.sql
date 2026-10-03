-- Documentos de carga (CT-e/MDF-e) via upload manual , base pra depois
-- plugar e-mail dedicado ou SEFAZ Direct sem redesenhar nada.

CREATE TYPE "TipoDocumentoCarga" AS ENUM ('CTE', 'MDFE');
CREATE TYPE "StatusCargaViagem" AS ENUM ('CARREGADO', 'VAZIO');

CREATE TABLE "documentos_carga" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "motoristaId" TEXT,
    "tipo" "TipoDocumentoCarga" NOT NULL,
    "numero" TEXT,
    "chaveAcesso" TEXT,
    "statusCarga" "StatusCargaViagem" NOT NULL DEFAULT 'CARREGADO',
    "xmlOriginal" BYTEA NOT NULL,
    "observacao" TEXT,
    "uploadedPorUsuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_carga_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "documentos_carga_empresaId_createdAt_idx" ON "documentos_carga"("empresaId", "createdAt");
CREATE INDEX "documentos_carga_motoristaId_idx" ON "documentos_carga"("motoristaId");

ALTER TABLE "documentos_carga" ADD CONSTRAINT "documentos_carga_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documentos_carga" ADD CONSTRAINT "documentos_carga_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documentos_carga" ADD CONSTRAINT "documentos_carga_uploadedPorUsuarioId_fkey" FOREIGN KEY ("uploadedPorUsuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fora do WORM de propósito: é um documento fiscal de apoio anexado
-- pelo gestor, não parte do ledger imutável de jornada do motorista
-- (o XML em si não muda, mas o registro pode precisar de correção de
-- metadados, ex.: motorista vinculado errado).
