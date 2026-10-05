-- Rodada 148: fuso do computador do gestor (aprendido pelo navegador), usado para
-- escrever a hora nas mensagens de WhatsApp na hora local de cada destinatário.
ALTER TABLE "usuarios_empresa" ADD COLUMN "fusoOffsetMin" INTEGER;
