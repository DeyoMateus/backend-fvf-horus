-- Rodada 71 , novo valor de TipoAlertaJornada: descanso interjornada
-- insuficiente (menos de 11h/660min entre o fim de uma jornada e o
-- início da próxima). Nunca bloqueia o registro , a lei não impede o
-- motorista de trabalhar, só exige que o gestor (e o próprio motorista,
-- no app) sejam avisados. Ver JornadaLegalService.avaliarDescansoInterjornada.
ALTER TYPE "TipoAlertaJornada" ADD VALUE 'DESCANSO_INTERJORNADA_INSUFICIENTE';
