-- Rodada 88 , coluna nova, nullable, pra não quebrar nenhum registro
-- histórico nem exigir reprocessar a cadeia de hash (este campo não
-- entra no hash, ver comentário em schema.prisma).
ALTER TABLE "registros_jornada" ADD COLUMN "elapsedRealtimeMs" DOUBLE PRECISION;
