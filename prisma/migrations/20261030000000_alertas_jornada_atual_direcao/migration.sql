-- Rodada 225: alertas de 8h/10h de direcao da jornada ATUAL (alem da soma encadeada).
ALTER TYPE "TipoAlertaJornada" ADD VALUE IF NOT EXISTS 'JORNADA_ATUAL_DIRECAO_PROXIMA_LIMITE';
ALTER TYPE "TipoAlertaJornada" ADD VALUE IF NOT EXISTS 'JORNADA_ATUAL_DIRECAO_EXCEDIDA';
