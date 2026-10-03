-- Rodada 33 , recuperação de senha ("esqueci minha senha") para
-- UsuarioEmpresa (com RLS, via grupo_do_usuario) e SuperAdminUsuario
-- (sem RLS, mesmo padrão de super_admin_refresh_tokens).

CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_usuarioId_idx" ON "password_reset_tokens"("usuarioId");

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== RLS: password_reset_tokens (via usuário -> grupo) =====
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON password_reset_tokens
  USING (app_bypass_rls() OR grupo_do_usuario("usuarioId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_usuario("usuarioId") = app_grupo_atual());

CREATE TABLE "super_admin_password_reset_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "superAdminId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "super_admin_password_reset_tokens_tokenHash_key" ON "super_admin_password_reset_tokens"("tokenHash");
CREATE INDEX "super_admin_password_reset_tokens_superAdminId_idx" ON "super_admin_password_reset_tokens"("superAdminId");

ALTER TABLE "super_admin_password_reset_tokens" ADD CONSTRAINT "super_admin_password_reset_tokens_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admin_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Sem RLS nesta tabela, de propósito (mesmo motivo de super_admin_refresh_tokens).
