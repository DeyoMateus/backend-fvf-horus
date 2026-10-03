-- Rodada 126: carimbo de "o motorista viu este alerta no app", separado
-- do visualizadoEm do gestor (painel). O alerta nunca é apagado nem
-- escondido por isto , só ganha este metadado opcional.
ALTER TABLE "alertas_jornada" ADD COLUMN "motoristaVisualizadoEm" TIMESTAMP(3);
