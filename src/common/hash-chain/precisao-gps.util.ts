/**
 * A precisão do GPS vem do aparelho como float32 ampliado para double
 * (ex.: 25.656999588012695). O Postgres/Prisma devolve esse valor
 * arredondado a 15 dígitos (25.6569995880127), então o hash calculado na
 * gravação (valor inteiro) nunca batia com o recálculo feito a partir do
 * banco, e todo registro com GPS aparecia como "alterado".
 * Arredondar a 2 casas (centímetro) ANTES de hashear e gravar garante que o
 * valor usado no hash seja exatamente o que volta do banco.
 */
export function arredondarPrecisaoGps(
  valor: number | null | undefined,
): number | null {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) {
    return null;
  }
  return Math.round(valor * 100) / 100;
}

/**
 * Latitude/longitude: 7 casas decimais, a mesma escala da coluna
 * `Decimal(10, 7)`. Deve ser aplicada ANTES do hash e da gravação.
 */
export function arredondarCoordenadaGps(
  valor: number | null | undefined,
): number | null {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) {
    return null;
  }
  return Math.round(valor * 1e7) / 1e7;
}
