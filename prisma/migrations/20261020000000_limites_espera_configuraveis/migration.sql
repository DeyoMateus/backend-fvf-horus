-- Rodada 174: limites de espera configuráveis por grupo (minutos; NULL = padrão).
ALTER TABLE "grupos" ADD COLUMN "limiteEsperaInfoMin" INTEGER;
ALTER TABLE "grupos" ADD COLUMN "limiteEsperaAtencaoMin" INTEGER;
ALTER TABLE "grupos" ADD COLUMN "limiteEsperaCriticoMin" INTEGER;
