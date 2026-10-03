-- Telefone opcional (E.164) pra notificação de alertas críticos via
-- WhatsApp Business API , canal adicional pro gestor, além do painel.
ALTER TABLE "usuarios_empresa" ADD COLUMN "telefoneWhatsapp" TEXT;
