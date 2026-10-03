-- Regra das 2 Conferências Consecutivas (ociosidade suspeita durante
-- "Em Direção") + autorrelato de folga do motorista.

ALTER TYPE "TipoAlertaJornada" ADD VALUE 'OCIOSIDADE_DIRECAO_SUSPEITA';

CREATE TABLE "autorrelatos_folga" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autorrelatos_folga_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "autorrelatos_folga_motoristaId_data_key" ON "autorrelatos_folga"("motoristaId", "data");

ALTER TABLE "autorrelatos_folga" ADD CONSTRAINT "autorrelatos_folga_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fora do WORM de propósito: é um aviso operacional do motorista (não é
-- ponto, não entra no ledger/hash chain), o gestor pode consultar mas
-- isto nunca precisa ser imutável.
