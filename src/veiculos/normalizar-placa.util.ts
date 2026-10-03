/** Maiúsculas, sem espaço , mesma placa digitada "abc1234" ou "ABC 1234" deve bater com "ABC1234". */
export function normalizarPlaca(placa: string): string {
  return placa.trim().toUpperCase().replace(/\s+/g, '');
}
