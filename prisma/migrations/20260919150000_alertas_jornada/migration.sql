-- Motor de limites legais de jornada (Lei 13.103/2015): novo tipo de
-- evento para fechar o intervalo de espera em carga/descarga, e a
-- tabela de alertas (não-WORM, operacional) gerada automaticamente.

ALTER TYPE "TipoEvento" ADD VALUE 'FIM_ESPERA_CARGA_DESCARGA';

CREATE TYPE "TipoAlertaJornada" AS ENUM (
  'DIRECAO_CONTINUA_PROXIMA_LIMITE',
  'DIRECAO_CONTINUA_EXCEDIDA',
  'JORNADA_DIRECAO_PROXIMA_LIMITE',
  'JORNADA_DIRECAO_EXCEDIDA',
  'ESPERA_PROXIMA_LIMITE',
  'ESPERA_LIMITE_LEGAL_ATINGIDO'
);

CREATE TYPE "SeveridadeAlerta" AS ENUM ('INFO', 'ATENCAO', 'CRITICO');

CREATE TABLE "alertas_jornada" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "tipo" "TipoAlertaJornada" NOT NULL,
    "severidade" "SeveridadeAlerta" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "janelaInicio" TIMESTAMP(3) NOT NULL,
    "janelaFim" TIMESTAMP(3) NOT NULL,
    "minutosAcumulados" INTEGER NOT NULL,
    "registroGeradorId" TEXT NOT NULL,
    "detalhes" JSONB,
    "visualizadoEm" TIMESTAMP(3),
    "visualizadoPorUsuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_jornada_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alertas_jornada_motoristaId_tipo_createdAt_idx" ON "alertas_jornada"("motoristaId", "tipo", "createdAt");

ALTER TABLE "alertas_jornada" ADD CONSTRAINT "alertas_jornada_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alertas_jornada" ADD CONSTRAINT "alertas_jornada_registroGeradorId_fkey" FOREIGN KEY ("registroGeradorId") REFERENCES "registros_jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nota: "alertas_jornada" fica de fora do trigger WORM de propósito ,
-- é notificação operacional (o gestor pode marcar visualizadoEm), não
-- parte do ledger imutável.
