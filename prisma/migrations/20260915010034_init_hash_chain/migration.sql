-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('INICIO_JORNADA', 'INICIO_REFEICAO', 'FIM_REFEICAO', 'INICIO_DESCANSO', 'FIM_DESCANSO', 'INICIO_DIRECAO', 'FIM_DIRECAO', 'ESPERA_CARGA_DESCARGA', 'FIM_JORNADA', 'ABASTECIMENTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusMotorista" AS ENUM ('ATIVO', 'INATIVO', 'SUSPENSO');

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motoristas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "cnh" TEXT NOT NULL,
    "status" "StatusMotorista" NOT NULL DEFAULT 'ATIVO',
    "empresaId" TEXT NOT NULL,
    "hashGenesis" TEXT NOT NULL,
    "certificadoPfxEnc" BYTEA,
    "certificadoIv" TEXT,
    "certificadoAuthTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motoristas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_jornada" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "tipoEvento" "TipoEvento" NOT NULL,
    "timestampEvento" TIMESTAMP(3) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "precisaoGpsM" DOUBLE PRECISION,
    "odometro" INTEGER,
    "observacao" TEXT,
    "sequencial" INTEGER NOT NULL,
    "hashAnterior" TEXT NOT NULL,
    "hashAtual" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_jornada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "motoristas_cpf_key" ON "motoristas"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "motoristas_cnh_key" ON "motoristas"("cnh");

-- CreateIndex
CREATE UNIQUE INDEX "motoristas_hashGenesis_key" ON "motoristas"("hashGenesis");

-- CreateIndex
CREATE UNIQUE INDEX "registros_jornada_hashAtual_key" ON "registros_jornada"("hashAtual");

-- CreateIndex
CREATE INDEX "registros_jornada_motoristaId_timestampEvento_idx" ON "registros_jornada"("motoristaId", "timestampEvento");

-- CreateIndex
CREATE UNIQUE INDEX "registros_jornada_motoristaId_sequencial_key" ON "registros_jornada"("motoristaId", "sequencial");

-- AddForeignKey
ALTER TABLE "motoristas" ADD CONSTRAINT "motoristas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_jornada" ADD CONSTRAINT "registros_jornada_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
