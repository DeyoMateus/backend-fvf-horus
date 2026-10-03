-- Folga concedida pelo RH/gestor a um motorista (diferente de
-- AutorrelatoFolga, que é o motorista se autorreportando sem
-- aprovação). Cobre dia futuro (motorista não precisa bater ponto) ou
-- dia passado que já tem RegistroJornada (nunca apaga/altera o que já
-- foi batido , só soma um alerta pra conferência, ver o novo valor de
-- enum abaixo).
--
-- ALTER TYPE ... ADD VALUE não pode ser usado na MESMA transação em que
-- o valor novo é referenciado, mas pode ser adicionado normalmente aqui
-- (nenhuma linha desta migration usa o valor novo).
ALTER TYPE "TipoAlertaJornada" ADD VALUE 'PONTO_REGISTRADO_EM_DIA_DE_FOLGA';

CREATE TABLE "folgas_concedidas" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "motivo" TEXT,
    "concedidaPorUsuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folgas_concedidas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "folgas_concedidas_motoristaId_data_key" ON "folgas_concedidas"("motoristaId", "data");

ALTER TABLE "folgas_concedidas" ADD CONSTRAINT "folgas_concedidas_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "folgas_concedidas" ADD CONSTRAINT "folgas_concedidas_concedidaPorUsuarioId_fkey" FOREIGN KEY ("concedidaPorUsuarioId") REFERENCES "usuarios_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
