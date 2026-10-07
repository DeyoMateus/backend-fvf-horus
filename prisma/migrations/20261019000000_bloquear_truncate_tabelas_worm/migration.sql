-- Rodada 167: os gatilhos WORM já bloqueavam UPDATE/DELETE linha a linha, mas
-- TRUNCATE não passa por gatilho de linha. Este gatilho de comando bloqueia
-- TRUNCATE (inclusive o disparado em cascata por outra tabela) nas tabelas
-- append-only. Quem for dono do banco ainda pode desligar o gatilho, mas
-- precisa fazer isso de propósito (ver "Reset controlado" na documentação).
CREATE OR REPLACE FUNCTION fn_bloquear_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Operacao TRUNCATE bloqueada: tabela % e append-only (WORM)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_registros_jornada_worm_truncate
  BEFORE TRUNCATE ON "registros_jornada"
  FOR EACH STATEMENT EXECUTE FUNCTION fn_bloquear_truncate();

CREATE TRIGGER trg_audit_log_worm_truncate
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION fn_bloquear_truncate();

CREATE TRIGGER trg_tratamentos_ponto_worm_truncate
  BEFORE TRUNCATE ON "tratamentos_ponto"
  FOR EACH STATEMENT EXECUTE FUNCTION fn_bloquear_truncate();

CREATE TRIGGER trg_amostras_localizacao_worm_truncate
  BEFORE TRUNCATE ON "amostras_localizacao"
  FOR EACH STATEMENT EXECUTE FUNCTION fn_bloquear_truncate();

CREATE TRIGGER trg_ajustes_banco_horas_worm_truncate
  BEFORE TRUNCATE ON "ajustes_banco_horas"
  FOR EACH STATEMENT EXECUTE FUNCTION fn_bloquear_truncate();

CREATE TRIGGER trg_integridade_aceites_worm_truncate
  BEFORE TRUNCATE ON "integridade_aceites"
  FOR EACH STATEMENT EXECUTE FUNCTION fn_bloquear_truncate();

CREATE TRIGGER trg_registros_jornada_ajudante_worm_truncate
  BEFORE TRUNCATE ON "registros_jornada_ajudante"
  FOR EACH STATEMENT EXECUTE FUNCTION fn_bloquear_truncate();
