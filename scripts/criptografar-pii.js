// Migra CPF/CNH/telefone de motoristas e ajudantes para a forma CIFRADA no
// banco (Rodada 199). Idempotente: só mexe no que ainda está em texto puro.
//
// Antes de rodar:
//   1) faça o BUILD do backend (`npm run build`), este script usa dist/;
//   2) tenha um backup recente do banco (R2 diário já existe);
//   3) CRYPTO_MASTER_KEY no ambiente (.env) = a MESMA do servidor.
//
// Uso (na pasta backend/, apontando DATABASE_URL para o banco desejado):
//   node scripts/criptografar-pii.js            -> só conta (simulação)
//   node scripts/criptografar-pii.js --aplicar  -> cifra de verdade
//   node scripts/criptografar-pii.js --reverter --aplicar -> volta ao texto puro
//
// Ordem recomendada em produção: 1) deploy com PII_ENCRYPTION_ENABLED=true;
// 2) rodar este script com --aplicar logo em seguida (enquanto não roda, a
// leitura funciona, mas busca/duplicidade por CPF não enxerga os antigos).
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const {
  cifrarCampo,
  decifrarCampo,
  estaCifrado,
} = require('../dist/common/crypto/pii-campo.util');

const aplicar = process.argv.includes('--aplicar');
const reverter = process.argv.includes('--reverter');

const TABELAS = [
  { tabela: 'motoristas', campos: ['cpf', 'cnh', 'telefone'] },
  { tabela: 'ajudantes', campos: ['cpf', 'telefone'] },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const { tabela, campos } of TABELAS) {
      const resumo = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe("SET LOCAL app.grupo_atual = '__sistema__'");
          const linhas = await tx.$queryRawUnsafe(
            `SELECT id, ${campos.map((c) => `"${c}"`).join(', ')} FROM "${tabela}"`,
          );
          let alteradas = 0;
          for (const linha of linhas) {
            const novos = {};
            for (const campo of campos) {
              const v = linha[campo];
              if (typeof v !== 'string' || v === '') continue;
              if (reverter ? estaCifrado(v) : !estaCifrado(v)) {
                novos[campo] = reverter
                  ? decifrarCampo(campo, v)
                  : cifrarCampo(campo, v);
              }
            }
            const chaves = Object.keys(novos);
            if (chaves.length === 0) continue;
            alteradas++;
            if (!aplicar) continue;
            const sets = chaves.map((c, i) => `"${c}" = $${i + 2}`).join(', ');
            await tx.$executeRawUnsafe(
              `UPDATE "${tabela}" SET ${sets} WHERE id = $1`,
              linha.id,
              ...chaves.map((c) => novos[c]),
            );
          }
          return { total: linhas.length, alteradas };
        },
        { timeout: 120000, maxWait: 20000 },
      );
      console.log(
        `${tabela}: ${resumo.total} linhas, ${resumo.alteradas} ${
          aplicar ? 'alteradas' : 'seriam alteradas (simulação)'
        }.`,
      );
    }
    if (!aplicar) console.log('\nNada foi gravado. Rode com --aplicar para efetivar.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Falhou:', e.message);
  process.exit(1);
});
