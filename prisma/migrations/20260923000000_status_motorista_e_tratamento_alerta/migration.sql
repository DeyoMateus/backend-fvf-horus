-- Rodada 25: cadastro de motorista nunca é apagado (é prova/evidência da
-- empresa) , a mudança de StatusMotorista (ATIVO/INATIVO/SUSPENSO), que já
-- existia no schema mas nunca tinha um endpoint que a alterasse, ganha um
-- endpoint dedicado (ver MotoristasController.atualizarStatus). Nenhuma
-- coluna nova aqui , só o endpoint no código.

-- Tratamento de alerta de jornada/fraude: até agora só existia
-- "visualizado" (marca como lido, sem registrar nenhuma decisão). Isso
-- ficava indistinguível de "ninguém olhou ainda" quando o gestor só
-- queria tirar da lista sem anotar nada , e não deixava nenhum rastro do
-- que foi de fato apurado (o registro estava certo? era falso positivo?
-- foi corrigido por um TratamentoPonto à parte?). `tratar` é uma segunda
-- ação, opcional e distinta de `visualizar`: exige uma observação
-- (mesmo padrão de motivo obrigatório do TratamentoPonto) e fica anexada
-- ao alerta permanentemente , nunca apaga nem esconde o alerta em si
-- (WORM/ledger continuam intocados; isto é só metadado de apuração).
ALTER TABLE "alertas_jornada" ADD COLUMN "tratadoEm" TIMESTAMP(3);
ALTER TABLE "alertas_jornada" ADD COLUMN "tratadoPorUsuarioId" TEXT;
ALTER TABLE "alertas_jornada" ADD COLUMN "tratamentoObservacao" TEXT;
