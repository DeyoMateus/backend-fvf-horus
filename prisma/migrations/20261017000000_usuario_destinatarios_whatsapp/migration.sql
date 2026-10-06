-- Rodada 164: o super admin define quem recebe alerta por WhatsApp (padrão: só a equipe de GR).
ALTER TABLE "usuarios_empresa" ADD COLUMN "recebeWhatsappAlertas" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "usuarios_empresa" ADD COLUMN "recebeWhatsappEquipeGr" BOOLEAN NOT NULL DEFAULT true;
