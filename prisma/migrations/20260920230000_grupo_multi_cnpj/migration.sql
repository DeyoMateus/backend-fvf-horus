-- Introduz o modelo Grupo (holding/multi-CNPJ): a partir de agora o
-- tenant/login é o Grupo, não a Empresa. Cada Empresa continua sendo
-- exatamente um CNPJ (mantém registroInpiAfd próprio, obrigatório pro
-- AFD), mas passa a pertencer a um Grupo, e usuarios_empresa passa a
-- se vincular ao Grupo em vez de a uma Empresa só.
--
-- Backfill: 1 Grupo novo por Empresa já existente, REAPROVEITANDO o
-- mesmo id da Empresa como id do Grupo. Isso evita precisar de uma
-- tabela de mapeamento só pra essa migração , como "id" é só um
-- namespace de chave primária por tabela, não há colisão em
-- reaproveitar o valor entre "empresas" e "grupos", e o backfill de
-- usuarios_empresa.grupoId fica trivial (era exatamente o empresaId
-- antigo). Grupos criados depois desta migração (2º CNPJ pra cima)
-- terão id gerado normalmente, sem relação com nenhuma Empresa.

-- CreateTable
CREATE TABLE "grupos" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupos_pkey" PRIMARY KEY ("id")
);

-- Backfill: 1 grupo por empresa existente (mesmo id da empresa).
INSERT INTO "grupos" ("id", "razaoSocial", "createdAt", "updatedAt")
SELECT "id", "razaoSocial", "createdAt", "updatedAt" FROM "empresas";

-- AlterTable: empresas.grupoId
ALTER TABLE "empresas" ADD COLUMN "grupoId" TEXT;
UPDATE "empresas" SET "grupoId" = "id";
ALTER TABLE "empresas" ALTER COLUMN "grupoId" SET NOT NULL;
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "empresas_grupoId_idx" ON "empresas"("grupoId");

-- AlterTable: usuarios_empresa.empresaId -> grupoId (renomeia; valores
-- antigos de empresaId já valem como grupoId por causa do backfill acima).
ALTER TABLE "usuarios_empresa" DROP CONSTRAINT "usuarios_empresa_empresaId_fkey";
ALTER TABLE "usuarios_empresa" RENAME COLUMN "empresaId" TO "grupoId";
ALTER TABLE "usuarios_empresa" ADD CONSTRAINT "usuarios_empresa_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER INDEX "usuarios_empresa_empresaId_idx" RENAME TO "usuarios_empresa_grupoId_idx";
