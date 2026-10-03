-- Fluxo de troca de aparelho: motorista solicita, só ADMIN/GESTOR aprova
-- ou rejeita. A solicitação em si não concede acesso nenhum.

CREATE TYPE "StatusSolicitacaoDispositivo" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

CREATE TABLE "solicitacoes_troca_dispositivo" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "deviceUuidSolicitado" TEXT NOT NULL,
    "modeloAparelho" TEXT,
    "sistemaOperacional" TEXT,
    "observacaoMotorista" TEXT,
    "status" "StatusSolicitacaoDispositivo" NOT NULL DEFAULT 'PENDENTE',
    "revisadoPorUsuarioId" TEXT,
    "revisadoEm" TIMESTAMP(3),
    "motivoRejeicao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_troca_dispositivo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solicitacoes_troca_dispositivo_motoristaId_status_idx" ON "solicitacoes_troca_dispositivo"("motoristaId", "status");

ALTER TABLE "solicitacoes_troca_dispositivo" ADD CONSTRAINT "solicitacoes_troca_dispositivo_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_troca_dispositivo" ADD CONSTRAINT "solicitacoes_troca_dispositivo_revisadoPorUsuarioId_fkey" FOREIGN KEY ("revisadoPorUsuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fora do WORM de propósito: é uma fila de trabalho operacional
-- (pendente/aprovada/rejeitada), não parte do ledger imutável.
