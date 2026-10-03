-- Rodada 29: cadastro de feriados definido pelo RH (por grupo/CNPJ).
-- Ver "Rodada 29" em claude/arquitetura-seguranca-controle-jornada.md.
--
-- Cogitou-se também assinatura digital do TratamentoPonto com
-- certificado próprio por gestor, mas pesquisa jurídica (Portaria MTP
-- 671/2021, CLT, TST) mostrou que não é exigido , o registro paralelo
-- (usuarioId + hashRegistro/hashReferencia, já existentes) já atende.

-- ===== Feriado =====

CREATE TABLE "feriados" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "empresaId" TEXT,
    "data" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "pagoComoDomingo" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorUsuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feriados_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feriados_grupoId_data_idx" ON "feriados"("grupoId", "data");
CREATE INDEX "feriados_empresaId_data_idx" ON "feriados"("empresaId", "data");

ALTER TABLE "feriados" ADD CONSTRAINT "feriados_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feriados" ADD CONSTRAINT "feriados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feriados" ADD CONSTRAINT "feriados_criadoPorUsuarioId_fkey" FOREIGN KEY ("criadoPorUsuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: feriados pertence direto a um grupo (mesmo padrão de regras_sindicais).
ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;
ALTER TABLE feriados FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON feriados
  USING (app_bypass_rls() OR "grupoId" = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR "grupoId" = app_grupo_atual());
