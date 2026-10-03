-- Novos tipos de alerta pro motor de antifraude (AntifraudeService),
-- reaproveitando a tabela alertas_jornada que já existe pro motor de
-- limites legais , mesma tabela operacional (não-WORM), mesmo fluxo de
-- push notification pro gestor em alertas CRITICO.
--
-- ALTER TYPE ... ADD VALUE não pode ser usado na MESMA transação em que
-- o valor novo é referenciado, mas pode ser adicionado normalmente aqui
-- (nenhuma linha desta migration usa os valores novos).

ALTER TYPE "TipoAlertaJornada" ADD VALUE 'VELOCIDADE_IMPOSSIVEL_ENTRE_REGISTROS';
ALTER TYPE "TipoAlertaJornada" ADD VALUE 'RELOGIO_DISPOSITIVO_SUSPEITO';
ALTER TYPE "TipoAlertaJornada" ADD VALUE 'SEQUENCIA_JORNADA_MUITO_RAPIDA';
ALTER TYPE "TipoAlertaJornada" ADD VALUE 'ODOMETRO_REGRESSIVO';
ALTER TYPE "TipoAlertaJornada" ADD VALUE 'INTEGRIDADE_DISPOSITIVO_SUSPEITA';
