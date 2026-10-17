-- Rodada 272: repeticao dos avisos de direcao continua em 10h e 11h sem pausa.
ALTER TYPE "TipoAlertaJornada" ADD VALUE IF NOT EXISTS 'DIRECAO_CONTINUA_REPETIDA_10H';
ALTER TYPE "TipoAlertaJornada" ADD VALUE IF NOT EXISTS 'DIRECAO_CONTINUA_REPETIDA_11H';
