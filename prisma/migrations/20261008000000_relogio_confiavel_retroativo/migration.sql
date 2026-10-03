-- Rodada 92 , "âncora de boot" com fonte EXTERNA de verdade (hora do
-- servidor, não o relógio do próprio aparelho), fechando (de forma
-- retroativa) a lacuna documentada na Rodada 91.

ALTER TYPE "TipoAlertaJornada" ADD VALUE 'RELOGIO_DIVERGENTE_DETECTADO_RETROATIVAMENTE';

CREATE TABLE "amostras_hora_confiavel" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "deviceUuidUsado" TEXT NOT NULL,
    "elapsedRealtimeMsNoMomento" DOUBLE PRECISION NOT NULL,
    "horaServidorNoMomento" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amostras_hora_confiavel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "amostras_hora_confiavel_motoristaId_deviceUuidUsado_elapse_idx"
  ON "amostras_hora_confiavel"("motoristaId", "deviceUuidUsado", "elapsedRealtimeMsNoMomento");

ALTER TABLE "amostras_hora_confiavel"
  ADD CONSTRAINT "amostras_hora_confiavel_motoristaId_fkey"
  FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "verificacoes_relogio_pendentes" (
    "id" TEXT NOT NULL,
    "registroJornadaId" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "deviceUuidUsado" TEXT NOT NULL,
    "elapsedRealtimeMs" DOUBLE PRECISION NOT NULL,
    "timestampEvento" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verificacoes_relogio_pendentes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verificacoes_relogio_pendentes_registroJornadaId_key"
  ON "verificacoes_relogio_pendentes"("registroJornadaId");

CREATE INDEX "verificacoes_relogio_pendentes_motoristaId_deviceUuidUsad_idx"
  ON "verificacoes_relogio_pendentes"("motoristaId", "deviceUuidUsado", "elapsedRealtimeMs");

ALTER TABLE "verificacoes_relogio_pendentes"
  ADD CONSTRAINT "verificacoes_relogio_pendentes_registroJornadaId_fkey"
  FOREIGN KEY ("registroJornadaId") REFERENCES "registros_jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "verificacoes_relogio_pendentes"
  ADD CONSTRAINT "verificacoes_relogio_pendentes_motoristaId_fkey"
  FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (Rodada 23 , mesmo padrão de todas as outras tabelas por
-- motoristaId: grupo_do_motorista()/app_grupo_atual()/app_bypass_rls()
-- já existem desde 20260922180000_row_level_security).
ALTER TABLE amostras_hora_confiavel ENABLE ROW LEVEL SECURITY;
ALTER TABLE amostras_hora_confiavel FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON amostras_hora_confiavel
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

ALTER TABLE verificacoes_relogio_pendentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE verificacoes_relogio_pendentes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON verificacoes_relogio_pendentes
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- Nota: nenhuma das duas tabelas é WORM. "amostras_hora_confiavel" é só
-- bookkeeping operacional (sem valor jurídico próprio);
-- "verificacoes_relogio_pendentes" precisa de DELETE (ver
-- RelogioConfiavelService.resolverPendencias) assim que cada pendência é
-- resolvida.
