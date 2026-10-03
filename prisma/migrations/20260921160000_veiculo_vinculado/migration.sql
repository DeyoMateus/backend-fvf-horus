-- Veículo de tração vinculado ao motorista (placa obrigatória desde
-- agora pro cadastro; idRastreador/tecnologiaRastreador ficam prontos
-- pra integração futura com rastreadores, nenhum dos dois obrigatório).

CREATE TYPE "TecnologiaRastreador" AS ENUM ('GPS', 'SATELITAL', 'CELULAR', 'RFID', 'OUTRO');

CREATE TABLE "veiculos_vinculados" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "idRastreador" TEXT,
    "tecnologiaRastreador" "TecnologiaRastreador",
    "atualizadoPorTipo" "ActorType" NOT NULL,
    "atualizadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veiculos_vinculados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "veiculos_vinculados_motoristaId_key" ON "veiculos_vinculados"("motoristaId");

ALTER TABLE "veiculos_vinculados" ADD CONSTRAINT "veiculos_vinculados_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Motoristas cadastrados ANTES desta migração ficam sem linha aqui
-- (a coluna motoristaId é NOT NULL, então não dá pra inserir uma linha
-- vazia por motorista sem inventar uma placa) , o próximo acesso do
-- gestor (ou do motorista, pelo app) ao cadastro deles pede pra
-- preencher a placa pela primeira vez, sem gerar o alerta de troca
-- (ver VeiculosService.atualizar: só alerta quando já havia uma placa
-- anterior diferente).
