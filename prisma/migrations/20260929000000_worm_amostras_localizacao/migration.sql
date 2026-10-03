-- Rodada 35 , hardening de segurança: estende o mesmo trigger WORM
-- (Write-Once-Read-Many, ver 20260918120000_add_auth_signature_audit)
-- para amostras_localizacao. A aplicacao nunca faz UPDATE/DELETE
-- nessa tabela (confirmado no codigo) , o registro de GPS periodico
-- do motorista e prova jurídica igual ao registro de ponto, e ate
-- agora só estava protegido contra alteracao por convencao de
-- codigo, nao por garantia de banco. Reaproveita a mesma funcao
-- fn_bloquear_update_delete() ja existente, sem duplicar logica.
CREATE TRIGGER trg_amostras_localizacao_worm
  BEFORE UPDATE OR DELETE ON "amostras_localizacao"
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_update_delete();
