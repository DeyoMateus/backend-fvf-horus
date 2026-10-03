-- Rodada 27: motor de regras sindicais (CCT/ACT) parametrizável por CNPJ +
-- fluxo de ajuste de ponto solicitado PELO MOTORISTA (com decisão do RH).
-- Ver "Rodada 27" em claude/arquitetura-seguranca-controle-jornada.md.

-- ===== RegraSindical =====

CREATE TYPE "CategoriaTransporteSindical" AS ENUM ('RODOVIARIO', 'URBANO');

CREATE TABLE "regras_sindicais" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoriaTransporte" "CategoriaTransporteSindical" NOT NULL DEFAULT 'RODOVIARIO',
    "toleranciaMarcacaoMin" INTEGER NOT NULL DEFAULT 0,
    "limiteJornadaNormalMin" INTEGER NOT NULL DEFAULT 480,
    "limiteHoraExtraFaixa1Min" INTEGER NOT NULL DEFAULT 120,
    "percentualHoraExtra1" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "percentualHoraExtra2" DECIMAL(5,2) NOT NULL DEFAULT 70,
    "percentualHoraExtraDomingoFeriado" DECIMAL(5,2),
    "percentualAdicionalNoturno" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "duracaoMinutoNoturnoMin" DECIMAL(5,2) NOT NULL DEFAULT 60,
    "bancoHorasPrazoExpiracaoMeses" INTEGER,
    "bancoHorasLimiteAlertaMin" INTEGER,
    "primeiroPeriodoDescansoMinimoMin" INTEGER NOT NULL DEFAULT 180,
    "intervaloRefeicaoMinimoMin" INTEGER NOT NULL DEFAULT 60,
    "percentualHoraEspera" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "percentualHoraEsperaRefeicao" DECIMAL(5,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_sindicais_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "regras_sindicais_grupoId_idx" ON "regras_sindicais"("grupoId");
ALTER TABLE "regras_sindicais" ADD CONSTRAINT "regras_sindicais_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Empresa ganha o vínculo opcional com uma RegraSindical =====

ALTER TABLE "empresas" ADD COLUMN "regraSindicalId" TEXT;
CREATE INDEX "empresas_regraSindicalId_idx" ON "empresas"("regraSindicalId");
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_regraSindicalId_fkey" FOREIGN KEY ("regraSindicalId") REFERENCES "regras_sindicais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===== SolicitacaoAjustePonto =====

CREATE TYPE "StatusSolicitacaoAjuste" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

CREATE TABLE "solicitacoes_ajuste_ponto" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "tipoEvento" "TipoEvento" NOT NULL,
    "timestampEvento" TIMESTAMP(3) NOT NULL,
    "justificativa" TEXT NOT NULL,
    "registroReferenciaId" TEXT,
    "status" "StatusSolicitacaoAjuste" NOT NULL DEFAULT 'PENDENTE',
    "decididoPorUsuarioId" TEXT,
    "decididoEm" TIMESTAMP(3),
    "motivoDecisao" TEXT,
    "tratamentoPontoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_ajuste_ponto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "solicitacoes_ajuste_ponto_tratamentoPontoId_key" ON "solicitacoes_ajuste_ponto"("tratamentoPontoId");
CREATE INDEX "solicitacoes_ajuste_ponto_motoristaId_status_idx" ON "solicitacoes_ajuste_ponto"("motoristaId", "status");

ALTER TABLE "solicitacoes_ajuste_ponto" ADD CONSTRAINT "solicitacoes_ajuste_ponto_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_ajuste_ponto" ADD CONSTRAINT "solicitacoes_ajuste_ponto_registroReferenciaId_fkey" FOREIGN KEY ("registroReferenciaId") REFERENCES "registros_jornada"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_ajuste_ponto" ADD CONSTRAINT "solicitacoes_ajuste_ponto_decididoPorUsuarioId_fkey" FOREIGN KEY ("decididoPorUsuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_ajuste_ponto" ADD CONSTRAINT "solicitacoes_ajuste_ponto_tratamentoPontoId_fkey" FOREIGN KEY ("tratamentoPontoId") REFERENCES "tratamentos_ponto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "solicitacoes_ajuste_ponto_evidencias" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "chaveStorage" TEXT,
    "conteudo" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_ajuste_ponto_evidencias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solicitacoes_ajuste_ponto_evidencias_solicitacaoId_idx" ON "solicitacoes_ajuste_ponto_evidencias"("solicitacaoId");
ALTER TABLE "solicitacoes_ajuste_ponto_evidencias" ADD CONSTRAINT "solicitacoes_ajuste_ponto_evidencias_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes_ajuste_ponto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== RLS =====
-- regras_sindicais: pertence direto a um grupo (mesmo padrão de "grupos").
ALTER TABLE regras_sindicais ENABLE ROW LEVEL SECURITY;
ALTER TABLE regras_sindicais FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON regras_sindicais
  USING (app_bypass_rls() OR "grupoId" = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR "grupoId" = app_grupo_atual());

-- solicitacoes_ajuste_ponto: via motorista -> empresa -> grupo (reaproveita grupo_do_motorista()).
ALTER TABLE solicitacoes_ajuste_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_ajuste_ponto FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON solicitacoes_ajuste_ponto
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- solicitacoes_ajuste_ponto_evidencias: via solicitacao -> motorista -> empresa -> grupo.
CREATE OR REPLACE FUNCTION grupo_da_solicitacao_ajuste(p_solicitacao_id text) RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT grupo_do_motorista(s."motoristaId") FROM solicitacoes_ajuste_ponto s WHERE s.id = p_solicitacao_id;
$$;

ALTER TABLE solicitacoes_ajuste_ponto_evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_ajuste_ponto_evidencias FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON solicitacoes_ajuste_ponto_evidencias
  USING (app_bypass_rls() OR grupo_da_solicitacao_ajuste("solicitacaoId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_da_solicitacao_ajuste("solicitacaoId") = app_grupo_atual());
