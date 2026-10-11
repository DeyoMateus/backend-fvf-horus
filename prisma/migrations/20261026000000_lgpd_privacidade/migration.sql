-- Rodada 206: LGPD (encarregado, ciencia da politica e pedidos do titular).
ALTER TABLE "empresas" ADD COLUMN "encarregadoNome" TEXT, ADD COLUMN "encarregadoEmail" TEXT, ADD COLUMN "encarregadoTelefone" TEXT;

CREATE TYPE "TipoDocumentoPrivacidade" AS ENUM ('POLITICA_PRIVACIDADE', 'TERMO_GPS');
CREATE TYPE "TipoSolicitacaoTitular" AS ENUM ('CONFIRMACAO_TRATAMENTO', 'ACESSO', 'CORRECAO', 'ANONIMIZACAO_ELIMINACAO', 'PORTABILIDADE', 'INFORMACAO_COMPARTILHAMENTO', 'REVOGACAO_CONSENTIMENTO', 'REVISAO_DECISAO_AUTOMATIZADA', 'OPOSICAO');
CREATE TYPE "StatusSolicitacaoTitular" AS ENUM ('ABERTA', 'EM_ANALISE', 'ATENDIDA', 'NEGADA_COM_JUSTIFICATIVA');

CREATE TABLE "aceites_privacidade" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumentoPrivacidade" NOT NULL,
    "versao" TEXT NOT NULL,
    "aceitoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "aceites_privacidade_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "aceites_privacidade_motoristaId_tipoDocumento_versao_key" ON "aceites_privacidade"("motoristaId", "tipoDocumento", "versao");
ALTER TABLE "aceites_privacidade" ADD CONSTRAINT "aceites_privacidade_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "solicitacoes_titular" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "tipo" "TipoSolicitacaoTitular" NOT NULL,
    "descricao" TEXT,
    "status" "StatusSolicitacaoTitular" NOT NULL DEFAULT 'ABERTA',
    "prazoEm" TIMESTAMP(3) NOT NULL,
    "resposta" TEXT,
    "respondidaEm" TIMESTAMP(3),
    "respondidaPorUsuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "solicitacoes_titular_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "solicitacoes_titular_motoristaId_createdAt_idx" ON "solicitacoes_titular"("motoristaId", "createdAt");
CREATE INDEX "solicitacoes_titular_status_prazoEm_idx" ON "solicitacoes_titular"("status", "prazoEm");
ALTER TABLE "solicitacoes_titular" ADD CONSTRAINT "solicitacoes_titular_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento por grupo (mesmo padrao de dias_sem_interacao_tratados).
ALTER TABLE "aceites_privacidade" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aceites_privacidade" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "aceites_privacidade"
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());
ALTER TABLE "solicitacoes_titular" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "solicitacoes_titular" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "solicitacoes_titular"
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());
