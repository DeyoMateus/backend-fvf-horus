-- Rodada 66 , recurso de Ajudante (cadastro separado do Motorista, sem
-- CNH e sem veículo, mesma integridade legal: cadeia de hash + WORM +
-- assinatura digital + device binding + soft-delete). Ver comentário no
-- schema.prisma, seção "AJUDANTE".

CREATE TABLE "ajudantes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "status" "StatusMotorista" NOT NULL DEFAULT 'ATIVO',
    "telefone" TEXT,
    "empresaId" TEXT NOT NULL,
    "hashGenesis" TEXT NOT NULL,
    "certificadoPfxEnc" BYTEA,
    "certificadoIv" TEXT,
    "certificadoAuthTag" TEXT,
    "certificadoFingerprint" TEXT,
    "certificadoValidoAte" TIMESTAMP(3),
    "excluidoEm" TIMESTAMP(3),
    "excluidoPorUsuarioId" TEXT,
    "motivoExclusao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ajudantes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ajudantes_cpf_key" ON "ajudantes"("cpf");
CREATE UNIQUE INDEX "ajudantes_hashGenesis_key" ON "ajudantes"("hashGenesis");
CREATE INDEX "ajudantes_empresaId_idx" ON "ajudantes"("empresaId");

ALTER TABLE "ajudantes" ADD CONSTRAINT "ajudantes_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "dispositivos_vinculados_ajudante" (
    "id" TEXT NOT NULL,
    "ajudanteId" TEXT NOT NULL,
    "deviceUuid" TEXT NOT NULL,
    "deviceApiKeyHash" TEXT NOT NULL,
    "pushToken" TEXT,
    "vinculadoPorUsuarioId" TEXT NOT NULL,
    "vinculadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispositivos_vinculados_ajudante_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dispositivos_vinculados_ajudante_ajudanteId_key" ON "dispositivos_vinculados_ajudante"("ajudanteId");
CREATE UNIQUE INDEX "dispositivos_vinculados_ajudante_deviceUuid_key" ON "dispositivos_vinculados_ajudante"("deviceUuid");

ALTER TABLE "dispositivos_vinculados_ajudante" ADD CONSTRAINT "dispositivos_vinculados_ajudante_ajudanteId_fkey"
  FOREIGN KEY ("ajudanteId") REFERENCES "ajudantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dispositivos_vinculados_ajudante" ADD CONSTRAINT "dispositivos_vinculados_ajudante_vinculadoPorUsuarioId_fkey"
  FOREIGN KEY ("vinculadoPorUsuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "registros_jornada_ajudante" (
    "id" TEXT NOT NULL,
    "ajudanteId" TEXT NOT NULL,
    "tipoEvento" "TipoEvento" NOT NULL,
    "timestampEvento" TIMESTAMP(3) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "precisaoGpsM" DOUBLE PRECISION,
    "observacao" TEXT,
    "sequencial" INTEGER NOT NULL,
    "hashAnterior" TEXT NOT NULL,
    "hashAtual" TEXT NOT NULL,
    "assinaturaDigital" TEXT,
    "algoritmoAssinatura" TEXT NOT NULL DEFAULT 'RSA-SHA256',
    "deviceUuidUsado" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_jornada_ajudante_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registros_jornada_ajudante_hashAtual_key" ON "registros_jornada_ajudante"("hashAtual");
CREATE UNIQUE INDEX "registros_jornada_ajudante_idempotencyKey_key" ON "registros_jornada_ajudante"("idempotencyKey");
CREATE UNIQUE INDEX "registros_jornada_ajudante_ajudanteId_sequencial_key" ON "registros_jornada_ajudante"("ajudanteId", "sequencial");
CREATE INDEX "registros_jornada_ajudante_ajudanteId_timestampEvento_idx" ON "registros_jornada_ajudante"("ajudanteId", "timestampEvento");

ALTER TABLE "registros_jornada_ajudante" ADD CONSTRAINT "registros_jornada_ajudante_ajudanteId_fkey"
  FOREIGN KEY ("ajudanteId") REFERENCES "ajudantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- WORM (mesma função já usada por registros_jornada/audit_log/etc , ver
-- migration add_auth_signature_audit).
CREATE TRIGGER trg_registros_jornada_ajudante_worm
  BEFORE UPDATE OR DELETE ON "registros_jornada_ajudante"
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_update_delete();

-- Row-Level Security (mesmo mecanismo da migration row_level_security ,
-- ver comentário lá para o raciocínio completo).
CREATE OR REPLACE FUNCTION grupo_do_ajudante(p_ajudante_id text) RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT e."grupoId" FROM ajudantes a JOIN empresas e ON e.id = a."empresaId" WHERE a.id = p_ajudante_id;
$$;

ALTER TABLE ajudantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ajudantes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ajudantes
  USING (app_bypass_rls() OR grupo_da_empresa("empresaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_da_empresa("empresaId") = app_grupo_atual());

ALTER TABLE dispositivos_vinculados_ajudante ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos_vinculados_ajudante FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dispositivos_vinculados_ajudante
  USING (app_bypass_rls() OR grupo_do_ajudante("ajudanteId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_ajudante("ajudanteId") = app_grupo_atual());

ALTER TABLE registros_jornada_ajudante ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_jornada_ajudante FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON registros_jornada_ajudante
  USING (app_bypass_rls() OR grupo_do_ajudante("ajudanteId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_ajudante("ajudanteId") = app_grupo_atual());
