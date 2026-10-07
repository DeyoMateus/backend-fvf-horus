import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Trava de segurança contra SQL injection: o código de produção só pode usar
 * SQL cru com template tagged (`$queryRaw\`...${x}\``, parametrizado pelo
 * Prisma). `$queryRawUnsafe` e `$executeRawUnsafe` são proibidos, exceto nos
 * arquivos permitidos abaixo (SET LOCAL de RLS com valor validado por
 * `grupoIdSeguro`, que o Postgres não aceita como parâmetro).
 */
const PERMITIDOS = new Set([
  'common/prisma/prisma.service.ts',
  'ajudantes/ajudantes.service.ts',
  'dispositivos/dispositivos.service.ts',
  'motoristas/motoristas.service.ts',
  'registros-jornada/registros-jornada.service.ts',
  'registros-jornada-ajudante/registros-jornada-ajudante.service.ts',
  'super-admin/super-admin.service.ts',
]);

function listar(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) listar(p, acc);
    else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) acc.push(p);
  }
  return acc;
}

describe('SQL cru seguro', () => {
  const raiz = join(process.cwd(), 'src');
  const arquivos = listar(raiz);

  it('não usa $queryRawUnsafe/$executeRawUnsafe fora da lista permitida', () => {
    const violacoes = arquivos.filter((f) => {
      const rel = f.slice(raiz.length + 1).replace(/\\/g, '/');
      if (PERMITIDOS.has(rel)) return false;
      return /\$(query|execute)RawUnsafe\s*\(/.test(readFileSync(f, 'utf8'));
    });
    expect(violacoes).toEqual([]);
  });

  it('SQL cru permitido só interpola grupoIdSeguro(...) ou constante', () => {
    for (const rel of PERMITIDOS) {
      const src = readFileSync(join(raiz, rel), 'utf8');
      const interpolacoes =
        src.match(/RawUnsafe\(\s*`[^`]*\$\{[^}]*\}[^`]*`/g) ?? [];
      for (const i of interpolacoes) {
        expect(i).toMatch(/\$\{(grupoIdSeguro\([^)]*\)|grupoEscapado)\}/);
      }
    }
  });
});
