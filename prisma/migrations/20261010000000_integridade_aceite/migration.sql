-- Rodada 125 , pedido do usuário: "se quebrou uma vez achando um
-- problema ele fica ali para sempre, não tem como ignorar ele para
-- regularizar". Tabela de aceite/regularização de divergências de
-- integridade (uma por motorista+sequencial do evento aceito), nunca
-- apaga nem recalcula hash, só documenta que o RH/gestor já revisou e
-- aceitou aquela divergência específica, com motivo e autoria.
CREATE TABLE "integridade_aceites" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "aceitoPorUsuarioId" TEXT NOT NULL,
    "aceitoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integridade_aceites_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "integridade_aceites_motoristaId_idx" ON "integridade_aceites"("motoristaId");

CREATE UNIQUE INDEX "integridade_aceites_motoristaId_sequencial_key" ON "integridade_aceites"("motoristaId", "sequencial");

ALTER TABLE "integridade_aceites" ADD CONSTRAINT "integridade_aceites_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integridade_aceites" ADD CONSTRAINT "integridade_aceites_aceitoPorUsuarioId_fkey" FOREIGN KEY ("aceitoPorUsuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== RLS: integridade_aceites (via motorista -> empresa -> grupo, mesma função grupo_do_motorista já existente) =====
ALTER TABLE integridade_aceites ENABLE ROW LEVEL SECURITY;
ALTER TABLE integridade_aceites FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON integridade_aceites
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- ===== WORM: um aceite nunca é editado/apagado depois de registrado (mesma função fn_bloquear_update_delete já existente) , pra "aceitar" continuar sendo uma decisão carimbada e auditável, nunca um apagar silencioso do problema =====
CREATE TRIGGER trg_integridade_aceites_worm
  BEFORE UPDATE OR DELETE ON "integridade_aceites"
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_update_delete();
