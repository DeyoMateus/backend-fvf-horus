-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('ADMIN', 'GESTOR');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USUARIO_EMPRESA', 'MOTORISTA', 'SISTEMA');

-- AlterTable: motoristas (metadados do certificado + credencial de dispositivo)
ALTER TABLE "motoristas"
  ADD COLUMN "certificadoFingerprint" TEXT,
  ADD COLUMN "certificadoValidoAte" TIMESTAMP(3),
  ADD COLUMN "deviceApiKeyHash" TEXT;

-- AlterTable: registros_jornada (nao-repudio + idempotencia offline)
ALTER TABLE "registros_jornada"
  ADD COLUMN "assinaturaDigital" TEXT,
  ADD COLUMN "algoritmoAssinatura" TEXT NOT NULL DEFAULT 'RSA-SHA256',
  ADD COLUMN "deviceId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "usuarios_empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL DEFAULT 'GESTOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "detalhes" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_empresa_email_key" ON "usuarios_empresa"("email");

-- CreateIndex
CREATE INDEX "usuarios_empresa_empresaId_idx" ON "usuarios_empresa"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_usuarioId_idx" ON "refresh_tokens"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "registros_jornada_idempotencyKey_key" ON "registros_jornada"("idempotencyKey");

-- CreateIndex
CREATE INDEX "audit_log_entidade_entidadeId_idx" ON "audit_log"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "usuarios_empresa" ADD CONSTRAINT "usuarios_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================
-- WORM enforcement (Write-Once-Read-Many)
-- Bloqueia UPDATE/DELETE em nivel de banco nas tabelas que compoem
-- o ledger de jornada e a trilha de auditoria, mesmo que alguem
-- obtenha acesso direto ao Postgres com credenciais da aplicacao.
-- Correcoes exigem um registro de estorno (novo evento), nunca
-- alteracao do historico - igual a um extrato bancario.
-- ==========================================
CREATE OR REPLACE FUNCTION fn_bloquear_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Operacao % bloqueada: tabela % e append-only (WORM)', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_registros_jornada_worm
  BEFORE UPDATE OR DELETE ON "registros_jornada"
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_update_delete();

CREATE TRIGGER trg_audit_log_worm
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_update_delete();
