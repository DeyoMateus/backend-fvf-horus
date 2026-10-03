-- Rodada 65 , "Excluir cadastro" de motorista, sem apagar histórico.
--
-- Continua um soft-delete (a linha de "motoristas" nunca é removida ,
-- ver comentário completo no schema.prisma, no campo `excluidoEm`):
-- não dá pra fazer DELETE de verdade na tabela sem quebrar a cadeia de
-- hash e todas as tabelas de histórico/auditoria que referenciam
-- motoristaId (registros de jornada, alertas, tratamentos de ponto,
-- folgas, documentos de carga, etc.) , todas continuam apontando para
-- este id normalmente, e nome/cpf/cnh continuam no lugar, então nada
-- que já buscava por nome ou gerava relatório histórico deixa de
-- funcionar.
ALTER TABLE "motoristas" ADD COLUMN "excluidoEm" TIMESTAMP(3);
ALTER TABLE "motoristas" ADD COLUMN "excluidoPorUsuarioId" TEXT;
ALTER TABLE "motoristas" ADD COLUMN "motivoExclusao" TEXT;
