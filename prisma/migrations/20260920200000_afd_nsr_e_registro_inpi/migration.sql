-- Suporte à exportação do AFD (Portaria MTP 671/2021), registro tipo 7 (REP-P).

ALTER TABLE "empresas" ADD COLUMN "registroInpiAfd" TEXT;

CREATE TABLE "afd_nsr" (
    "nsr" SERIAL NOT NULL,
    "chaveOrigem" TEXT NOT NULL,
    "tipoRegistro" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "afd_nsr_pkey" PRIMARY KEY ("nsr")
);

CREATE UNIQUE INDEX "afd_nsr_chaveOrigem_key" ON "afd_nsr"("chaveOrigem");
