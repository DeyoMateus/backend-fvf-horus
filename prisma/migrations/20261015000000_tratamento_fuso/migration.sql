-- Rodada 150: fuso (min a leste do UTC) em que o motorista estava no instante do ajuste do RH.
ALTER TABLE "tratamentos_ponto" ADD COLUMN "fusoOffsetMin" INTEGER;
