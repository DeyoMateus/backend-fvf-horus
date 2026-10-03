-- Rodada 72 , novo valor de TipoAlertaJornada: início de direção sem
-- CT-e vinculado/emitido recentemente, com um CT-e em aberto pendente
-- (não entregue) encontrado no sistema. Nunca bloqueia o registro ,
-- só avisa gestor (alerta no painel + WhatsApp).
ALTER TYPE "TipoAlertaJornada" ADD VALUE 'CTE_EM_ABERTO_SEM_VINCULO_RECENTE';
