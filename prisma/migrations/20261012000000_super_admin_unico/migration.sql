-- Regra de negócio: só pode existir UM super admin na plataforma.
-- O índice único sobre uma expressão constante faz o banco recusar qualquer
-- segunda linha em super_admin_usuarios (inclusive inativa).
CREATE UNIQUE INDEX IF NOT EXISTS "super_admin_usuarios_unico" ON "super_admin_usuarios" ((true));
