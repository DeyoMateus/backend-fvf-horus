-- Rodada 66 , grupoId estável em audit_log, pra dar suporte ao painel
-- visual de auditoria (ADMIN/GESTOR vê só o próprio grupo; SUPER_ADMIN
-- vê tudo, grupoId nulo incluso). Ver comentário no schema.prisma.
ALTER TABLE "audit_log" ADD COLUMN "grupoId" TEXT;

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_grupoId_fkey"
  FOREIGN KEY ("grupoId") REFERENCES "grupos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "audit_log_grupoId_createdAt_idx" ON "audit_log"("grupoId", "createdAt");
