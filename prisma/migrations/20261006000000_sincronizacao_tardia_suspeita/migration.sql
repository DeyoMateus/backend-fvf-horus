-- Rodada 87 , novo valor de TipoAlertaJornada: evento sincronizado com
-- atraso grande demais pra ser só "motorista ficou sem sinal" (ver
-- AntifraudeService.avaliarSincronizacaoTardiaSuspeita). Nunca bloqueia
-- o registro , só avisa gestor, exatamente como os outros sinais de
-- antifraude.
ALTER TYPE "TipoAlertaJornada" ADD VALUE 'SINCRONIZACAO_TARDIA_SUSPEITA';
