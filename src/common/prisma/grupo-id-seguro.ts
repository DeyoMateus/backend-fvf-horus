const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Valor de `app.grupo_atual` (RLS) é interpolado no `SET LOCAL` (o Postgres
 * não aceita parâmetro `$1` nesse comando). Para eliminar qualquer chance de
 * injeção de SQL, só aceitamos UUID ou o marcador interno `__sistema__`;
 * qualquer outra coisa lança erro antes de chegar ao banco.
 */
export function grupoIdSeguro(grupoId: string): string {
  if (grupoId === '__sistema__' || UUID_REGEX.test(grupoId)) return grupoId;
  throw new Error('grupoId inválido para o contexto de RLS.');
}
