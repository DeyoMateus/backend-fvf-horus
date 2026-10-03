-- Rodada 37 , Banco de horas (toggle em RegraSindical + ledger de
-- ajustes por motorista). Ver comentário completo no schema.prisma
-- sobre por que o CRÉDITO "normal" (hora extra apurada no período)
-- nunca é duplicado numa tabela própria , só os ajustes manuais
-- (compensação/pagamento/correção) precisam de persistência.

-- ===== Toggle explícito em regras_sindicais =====
ALTER TABLE "regras_sindicais" ADD COLUMN "bancoHorasAtivo" BOOLEAN NOT NULL DEFAULT false;

-- ===== Enum + tabela do ledger =====
CREATE TYPE "TipoAjusteBancoHoras" AS ENUM ('COMPENSACAO', 'PAGAMENTO', 'CORRECAO_CREDITO', 'CORRECAO_DEBITO');

CREATE TABLE "ajustes_banco_horas" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "tipo" "TipoAjusteBancoHoras" NOT NULL,
    "minutos" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "observacao" TEXT,
    "registradoPorUsuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_banco_horas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ajustes_banco_horas_motoristaId_idx" ON "ajustes_banco_horas"("motoristaId");

ALTER TABLE "ajustes_banco_horas" ADD CONSTRAINT "ajustes_banco_horas_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ajustes_banco_horas" ADD CONSTRAINT "ajustes_banco_horas_registradoPorUsuarioId_fkey" FOREIGN KEY ("registradoPorUsuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== RLS: ajustes_banco_horas (via motorista -> empresa -> grupo, mesma função grupo_do_motorista já existente) =====
ALTER TABLE ajustes_banco_horas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes_banco_horas FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ajustes_banco_horas
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- ===== WORM: ajuste de banco de horas nunca é editado/apagado depois de criado (mesma função fn_bloquear_update_delete já existente) =====
CREATE TRIGGER trg_ajustes_banco_horas_worm
  BEFORE UPDATE OR DELETE ON "ajustes_banco_horas"
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_update_delete();
