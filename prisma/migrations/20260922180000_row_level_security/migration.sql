-- Row-Level Security (RLS) como segunda camada de isolamento multi-tenant,
-- complementar (não substituta) ao TenantService/checagem de aplicação já
-- existente. Ver "Rodada 23" em claude/arquitetura-seguranca-controle-jornada.md.
--
-- Mecanismo: cada conexão/transação Postgres seta a variável de sessão
-- `app.grupo_atual` (via `SET LOCAL`, feito pelo backend em
-- backend/src/common/prisma/prisma.service.ts) antes de qualquer leitura
-- ou escrita numa tabela protegida. As políticas abaixo comparam essa
-- variável com o grupo (ou o grupo derivado, via as funções auxiliares)
-- da linha sendo lida/gravada. Um único valor-sentinela, '__sistema__',
-- é a ÚNICA forma de pular a checagem (usado só pelos poucos pontos do
-- backend que legitimamente cruzam vários grupos de propósito , a
-- varredura de segurança da Rodada 19/20, o processor da fila de
-- verificação agendada da Rodada 21, o seed script, e o login/troca de
-- dispositivo antes de se saber a qual grupo o usuário/motorista
-- pertence). Se a variável de sessão nunca foi setada (código que
-- esqueceu de passar por um contexto de tenant), o valor é NULL/vazio, o
-- que não bate com nenhuma política , falha FECHADA por padrão (nega
-- tudo), nunca aberta.
--
-- FORCE ROW LEVEL SECURITY é usado em todas as tabelas abaixo para que a
-- política valha mesmo para o dono/criador das tabelas (a role da
-- aplicação), não só para roles "de fora" , sem isso, o dono do banco
-- ignora RLS por padrão no Postgres.
--
-- Fora de propósito, intencionalmente: `audit_log` (não tem um grupoId
-- estável , actorId pode ser um motorista, um usuário ou o próprio
-- SISTEMA, entidade é genérica) e `afd_nsr` (contador global e
-- monotônico de NSR exigido pela Portaria 671/2021 , tem que valer para
-- TODOS os grupos, nunca ser filtrado por tenant).

CREATE OR REPLACE FUNCTION app_grupo_atual() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT current_setting('app.grupo_atual', true);
$$;

CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT current_setting('app.grupo_atual', true) = '__sistema__';
$$;

-- Um hop: empresa (CNPJ) -> grupo.
CREATE OR REPLACE FUNCTION grupo_da_empresa(p_empresa_id text) RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT "grupoId" FROM empresas WHERE id = p_empresa_id;
$$;

-- Dois hops: motorista -> empresa -> grupo.
CREATE OR REPLACE FUNCTION grupo_do_motorista(p_motorista_id text) RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT e."grupoId" FROM motoristas m JOIN empresas e ON e.id = m."empresaId" WHERE m.id = p_motorista_id;
$$;

-- Dois hops: usuário -> grupo (direto, mas via função por simetria com as demais políticas).
CREATE OR REPLACE FUNCTION grupo_do_usuario(p_usuario_id text) RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT "grupoId" FROM usuarios_empresa WHERE id = p_usuario_id;
$$;

-- ===== grupos =====
ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON grupos
  USING (app_bypass_rls() OR id = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR id = app_grupo_atual());

-- ===== empresas =====
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON empresas
  USING (app_bypass_rls() OR "grupoId" = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR "grupoId" = app_grupo_atual());

-- ===== usuarios_empresa =====
ALTER TABLE usuarios_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_empresa FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON usuarios_empresa
  USING (app_bypass_rls() OR "grupoId" = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR "grupoId" = app_grupo_atual());

-- ===== refresh_tokens (via usuário -> grupo) =====
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON refresh_tokens
  USING (app_bypass_rls() OR grupo_do_usuario("usuarioId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_usuario("usuarioId") = app_grupo_atual());

-- ===== motoristas (via empresa -> grupo) =====
ALTER TABLE motoristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE motoristas FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON motoristas
  USING (app_bypass_rls() OR grupo_da_empresa("empresaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_da_empresa("empresaId") = app_grupo_atual());

-- ===== dispositivos_vinculados (via motorista -> empresa -> grupo) =====
ALTER TABLE dispositivos_vinculados ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos_vinculados FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dispositivos_vinculados
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- ===== veiculos_vinculados (via motorista -> empresa -> grupo) =====
ALTER TABLE veiculos_vinculados ENABLE ROW LEVEL SECURITY;
ALTER TABLE veiculos_vinculados FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON veiculos_vinculados
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- ===== amostras_localizacao (via motorista -> empresa -> grupo) =====
ALTER TABLE amostras_localizacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE amostras_localizacao FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON amostras_localizacao
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- ===== registros_jornada (WORM , via motorista -> empresa -> grupo) =====
ALTER TABLE registros_jornada ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_jornada FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON registros_jornada
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- ===== tratamentos_ponto (via motorista -> empresa -> grupo) =====
ALTER TABLE tratamentos_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE tratamentos_ponto FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tratamentos_ponto
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- ===== alertas_jornada (via motorista -> empresa -> grupo) =====
ALTER TABLE alertas_jornada ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_jornada FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON alertas_jornada
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- ===== solicitacoes_troca_dispositivo (via motorista -> empresa -> grupo) =====
ALTER TABLE solicitacoes_troca_dispositivo ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_troca_dispositivo FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON solicitacoes_troca_dispositivo
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- ===== autorrelatos_folga (via motorista -> empresa -> grupo) =====
ALTER TABLE autorrelatos_folga ENABLE ROW LEVEL SECURITY;
ALTER TABLE autorrelatos_folga FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON autorrelatos_folga
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- ===== folgas_concedidas (via motorista -> empresa -> grupo) =====
ALTER TABLE folgas_concedidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE folgas_concedidas FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON folgas_concedidas
  USING (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_do_motorista("motoristaId") = app_grupo_atual());

-- ===== documentos_carga (via empresa -> grupo , motoristaId é opcional aqui) =====
ALTER TABLE documentos_carga ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_carga FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON documentos_carga
  USING (app_bypass_rls() OR grupo_da_empresa("empresaId") = app_grupo_atual())
  WITH CHECK (app_bypass_rls() OR grupo_da_empresa("empresaId") = app_grupo_atual());
