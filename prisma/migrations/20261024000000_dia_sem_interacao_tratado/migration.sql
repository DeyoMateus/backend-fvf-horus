-- Rodada 193: tratamento de "dias sem interação" pelo gestor (radar).
CREATE TYPE "TipoTratamentoDiaSemInteracao" AS ENUM ('FOLGA', 'FALTA', 'ATESTADO', 'OUTRO');

CREATE TABLE "dias_sem_interacao_tratados" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoTratamentoDiaSemInteracao" NOT NULL,
    "observacao" TEXT NOT NULL,
    "tratadoPorUsuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dias_sem_interacao_tratados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dias_sem_interacao_tratados_motoristaId_data_key" ON "dias_sem_interacao_tratados"("motoristaId", "data");

ALTER TABLE "dias_sem_interacao_tratados" ADD CONSTRAINT "dias_sem_interacao_tratados_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dias_sem_interacao_tratados" ADD CONSTRAINT "dias_sem_interacao_tratados_tratadoPorUsuarioId_fkey" FOREIGN KEY ("tratadoPorUsuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento por grupo (mesmo padrão de folgas_concedidas, ver migration row_level_security).
ALTER TABLE "dias_sem_interacao_tratados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dias_sem_interacao_tratados" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "dias_sem_interacao_tratados"
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());
