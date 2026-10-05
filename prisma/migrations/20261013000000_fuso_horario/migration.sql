-- Rodada 146: fuso horário. Mudança ADITIVA e segura (colunas novas, sem
-- reescrever nem recalcular nada existente).
--
-- registros_jornada.fusoOffsetMin: minutos a leste do UTC em que o motorista
-- estava no momento do toque (NULL em registros antigos / app antigo).
ALTER TABLE "registros_jornada" ADD COLUMN "fusoOffsetMin" INTEGER;

-- empresas.fusoHorario: fuso IANA da transportadora (exibição). Todas as
-- empresas existentes ficam em America/Sao_Paulo, o comportamento atual.
ALTER TABLE "empresas" ADD COLUMN "fusoHorario" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
