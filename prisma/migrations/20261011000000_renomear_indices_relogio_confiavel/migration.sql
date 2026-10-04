-- Renomeia os índices criados em 20261008000000 para os nomes que o Prisma
-- espera. IF EXISTS deixa a migration segura tanto em banco novo (índices com
-- nome antigo) quanto em banco de desenvolvimento (já renomeados).
ALTER INDEX IF EXISTS "amostras_hora_confiavel_motoristaId_deviceUuidUsado_elapse_idx" RENAME TO "amostras_hora_confiavel_motoristaId_deviceUuidUsado_elapsed_idx";

ALTER INDEX IF EXISTS "verificacoes_relogio_pendentes_motoristaId_deviceUuidUsad_idx" RENAME TO "verificacoes_relogio_pendentes_motoristaId_deviceUuidUsado__idx";
