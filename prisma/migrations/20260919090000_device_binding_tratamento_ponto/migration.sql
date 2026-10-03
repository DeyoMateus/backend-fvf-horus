-- Device binding: a credencial de dispositivo sai de "motoristas" e passa
-- a viver em "dispositivos_vinculados" (1 vinculo atual por motorista,
-- trocar substitui o anterior - igual senha, sem historico).
ALTER TABLE "motoristas" DROP COLUMN IF EXISTS "deviceApiKeyHash";

CREATE TABLE "dispositivos_vinculados" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "deviceUuid" TEXT NOT NULL,
    "deviceApiKeyHash" TEXT NOT NULL,
    "vinculadoPorUsuarioId" TEXT NOT NULL,
    "vinculadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispositivos_vinculados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dispositivos_vinculados_motoristaId_key" ON "dispositivos_vinculados"("motoristaId");
CREATE UNIQUE INDEX "dispositivos_vinculados_deviceUuid_key" ON "dispositivos_vinculados"("deviceUuid");

ALTER TABLE "dispositivos_vinculados" ADD CONSTRAINT "dispositivos_vinculados_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dispositivos_vinculados" ADD CONSTRAINT "dispositivos_vinculados_vinculadoPorUsuarioId_fkey" FOREIGN KEY ("vinculadoPorUsuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RegistroJornada: deviceId (informativo) passa a ser deviceUuidUsado
-- (obrigatorio, entra no hash de cada evento).
ALTER TABLE "registros_jornada" RENAME COLUMN "deviceId" TO "deviceUuidUsado";
ALTER TABLE "registros_jornada" ALTER COLUMN "deviceUuidUsado" SET NOT NULL;

-- Tratamento de ponto: correcao/justificativa do RH/gestor, apenas
-- informativo (sem workflow de aprovacao), nunca altera registros_jornada.
CREATE TABLE "tratamentos_ponto" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipoEvento" "TipoEvento" NOT NULL,
    "timestampEvento" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "registroReferenciaId" TEXT,
    "hashReferencia" TEXT NOT NULL,
    "hashRegistro" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tratamentos_ponto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tratamentos_ponto_hashRegistro_key" ON "tratamentos_ponto"("hashRegistro");
CREATE INDEX "tratamentos_ponto_motoristaId_timestampEvento_idx" ON "tratamentos_ponto"("motoristaId", "timestampEvento");

ALTER TABLE "tratamentos_ponto" ADD CONSTRAINT "tratamentos_ponto_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tratamentos_ponto" ADD CONSTRAINT "tratamentos_ponto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tratamentos_ponto" ADD CONSTRAINT "tratamentos_ponto_registroReferenciaId_fkey" FOREIGN KEY ("registroReferenciaId") REFERENCES "registros_jornada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- WORM (append-only) tambem para tratamentos_ponto: e trilha de auditoria
-- de correcao, nunca deve ser editada ou apagada depois de criada.
CREATE TRIGGER trg_tratamentos_ponto_worm
  BEFORE UPDATE OR DELETE ON "tratamentos_ponto"
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_update_delete();
