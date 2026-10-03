-- Rodada 31: super admin da plataforma (dono do FVF Hórus) + endpoint
-- para o ADMIN de um grupo criar outros usuários (gestores) dentro do
-- próprio grupo. Ver "Rodada 31" em
-- claude/arquitetura-seguranca-controle-jornada.md.

-- ===== ActorType.SUPER_ADMIN (audit log) =====
ALTER TYPE "ActorType" ADD VALUE 'SUPER_ADMIN';

-- ===== SuperAdminUsuario / SuperAdminRefreshToken =====
-- Fora do Grupo de propósito (ver comentário no schema.prisma e em
-- prisma.service.ts) , não entram em MODELOS_COM_RLS, nunca ganham
-- FORCE ROW LEVEL SECURITY.

CREATE TABLE "super_admin_usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admin_usuarios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "super_admin_usuarios_email_key" ON "super_admin_usuarios"("email");

CREATE TABLE "super_admin_refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "superAdminId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "super_admin_refresh_tokens_tokenHash_key" ON "super_admin_refresh_tokens"("tokenHash");
CREATE INDEX "super_admin_refresh_tokens_superAdminId_idx" ON "super_admin_refresh_tokens"("superAdminId");

ALTER TABLE "super_admin_refresh_tokens" ADD CONSTRAINT "super_admin_refresh_tokens_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admin_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
