-- Rodada 32: super admin passa a poder editar o cadastro de uma
-- empresa depois de criada (razão social do Grupo, razão social/CNPJ/
-- registroInpiAfd de cada CNPJ, ativar/desativar um CNPJ, e corrigir
-- nome/e-mail de um usuário) , ver "Rodada 32" em
-- claude/arquitetura-seguranca-controle-jornada.md.

-- Empresa nunca é apagada, só desativada (mesmo padrão já usado em
-- Motorista.status e UsuarioEmpresa.ativo) , campo novo, informativo
-- por enquanto (não bloqueia nada em runtime ainda).
ALTER TABLE "empresas" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
