-- Rodada 221: o motorista pede folga (1 a 15 dias seguidos) e o RH decide.
CREATE TYPE "StatusSolicitacaoFolga" AS ENUM ('PENDENTE', 'APROVADA', 'NEGADA');

CREATE TABLE "solicitacoes_folga" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "observacao" TEXT,
    "status" "StatusSolicitacaoFolga" NOT NULL DEFAULT 'PENDENTE',
    "decididoPorUsuarioId" TEXT,
    "decididoEm" TIMESTAMP(3),
    "motivoDecisao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_folga_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solicitacoes_folga_motoristaId_status_idx" ON "solicitacoes_folga"("motoristaId", "status");

ALTER TABLE "solicitacoes_folga" ADD CONSTRAINT "solicitacoes_folga_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_folga" ADD CONSTRAINT "solicitacoes_folga_decididoPorUsuarioId_fkey" FOREIGN KEY ("decididoPorUsuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Isolamento por grupo (mesmo padrão de folgas_concedidas).
ALTER TABLE "solicitacoes_folga" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "solicitacoes_folga" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "solicitacoes_folga"
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());
