-- Rodada 68 , dois novos valores de TipoAlertaJornada para o motor de
-- "tempo indefinido" (jornada aberta sem etapa em aberto , nem
-- direção, nem descanso, nem espera, nem aguardando documentação).
ALTER TYPE "TipoAlertaJornada" ADD VALUE 'TEMPO_INDEFINIDO_PROXIMO_LIMITE';
ALTER TYPE "TipoAlertaJornada" ADD VALUE 'TEMPO_INDEFINIDO_PROLONGADO';
