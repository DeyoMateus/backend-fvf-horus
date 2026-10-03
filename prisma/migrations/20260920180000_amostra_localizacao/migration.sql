-- Amostragem periódica de GPS em segundo plano (ver comentário do model
-- AmostraLocalizacao no schema.prisma).
CREATE TABLE "amostras_localizacao" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "precisaoGpsM" DOUBLE PRECISION,
    "capturadoEm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amostras_localizacao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "amostras_localizacao_motoristaId_capturadoEm_idx" ON "amostras_localizacao"("motoristaId", "capturadoEm");

ALTER TABLE "amostras_localizacao" ADD CONSTRAINT "amostras_localizacao_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
