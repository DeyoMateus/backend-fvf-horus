-- Remove INICIO_REFEICAO, FIM_REFEICAO e ABASTECIMENTO do enum
-- TipoEvento (decisão do usuário: refeição passa a ser registrada
-- como um descanso comum; abastecimento não é mais um evento de
-- jornada). Linhas existentes com esses valores (esperado: só dados
-- de teste em ambiente de desenvolvimento) são migradas em vez de
-- rejeitadas, pra não quebrar a cadeia de hash (o hash já calculado
-- referencia o registro por id/sequencial, não muda com este
-- remapeamento de rótulo) nem perder histórico:
--   INICIO_REFEICAO -> INICIO_DESCANSO
--   FIM_REFEICAO    -> FIM_DESCANSO
--   ABASTECIMENTO   -> OUTRO

BEGIN;

ALTER TYPE "TipoEvento" RENAME TO "TipoEvento_old";

CREATE TYPE "TipoEvento" AS ENUM (
  'INICIO_JORNADA',
  'INICIO_DESCANSO',
  'FIM_DESCANSO',
  'INICIO_DIRECAO',
  'FIM_DIRECAO',
  'ESPERA_CARGA_DESCARGA',
  'FIM_ESPERA_CARGA_DESCARGA',
  'FIM_JORNADA',
  'OUTRO'
);

ALTER TABLE "registros_jornada"
  ALTER COLUMN "tipoEvento" TYPE "TipoEvento" USING (
    CASE "tipoEvento"::text
      WHEN 'INICIO_REFEICAO' THEN 'INICIO_DESCANSO'
      WHEN 'FIM_REFEICAO' THEN 'FIM_DESCANSO'
      WHEN 'ABASTECIMENTO' THEN 'OUTRO'
      ELSE "tipoEvento"::text
    END
  )::"TipoEvento";

ALTER TABLE "tratamentos_ponto"
  ALTER COLUMN "tipoEvento" TYPE "TipoEvento" USING (
    CASE "tipoEvento"::text
      WHEN 'INICIO_REFEICAO' THEN 'INICIO_DESCANSO'
      WHEN 'FIM_REFEICAO' THEN 'FIM_DESCANSO'
      WHEN 'ABASTECIMENTO' THEN 'OUTRO'
      ELSE "tipoEvento"::text
    END
  )::"TipoEvento";

DROP TYPE "TipoEvento_old";

COMMIT;
