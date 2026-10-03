-- Rodada 26: evidências anexadas pelo gestor ao fechar um ponto que o
-- motorista esqueceu de bater (print de rastreador, print de WhatsApp,
-- etc.) + campo de ciência do motorista sobre o ajuste.
-- Ver "Rodada 26" em claude/arquitetura-seguranca-controle-jornada.md.

ALTER TABLE "tratamentos_ponto" ADD COLUMN "motoristaCienciaEm" TIMESTAMP(3);

CREATE TABLE "tratamentos_ponto_evidencias" (
    "id" TEXT NOT NULL,
    "tratamentoId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "chaveStorage" TEXT,
    "conteudo" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tratamentos_ponto_evidencias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tratamentos_ponto_evidencias_tratamentoId_idx" ON "tratamentos_ponto_evidencias"("tratamentoId");

ALTER TABLE "tratamentos_ponto_evidencias" ADD CONSTRAINT "tratamentos_ponto_evidencias_tratamentoId_fkey" FOREIGN KEY ("tratamentoId") REFERENCES "tratamentos_ponto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== RLS: tratamentos_ponto_evidencias (via tratamento -> motorista -> empresa -> grupo) =====
-- Reaproveita grupo_do_motorista(), definida na migration de RLS da Rodada 23
-- (20260922180000_row_level_security). Aqui só falta o hop tratamento -> motoristaId.

CREATE OR REPLACE FUNCTION grupo_do_tratamento(p_tratamento_id text) RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT grupo_do_motorista(t."motoristaId") FROM tratamentos_ponto t WHERE t.id = p_tratamento_id;
$$;

ALTER TABLE tratamentos_ponto_evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE tratamentos_ponto_evidencias FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tratamentos_ponto_evidencias
  USING (app_bypass_rls() OR grupo_do_tratamento("tratamentoId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_tratamento("tratamentoId") = app_grupo_atual());
