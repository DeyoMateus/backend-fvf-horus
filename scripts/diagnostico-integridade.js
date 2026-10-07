/* Diagnóstico SOMENTE LEITURA da cadeia de hashes. Uso (na pasta backend):
 *   node scripts/diagnostico-integridade.js > diagnostico.json
 * Lê DATABASE_URL do .env e NÃO imprime credenciais. */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('crypto');

const sha = (v) => createHash('sha256').update(v).digest('hex');
const num = (v) => (v === null || v === undefined ? null : Number.isNaN(Number(v)) ? null : Number(v));

function canon(r, o = {}) {
  const lat = o.lat !== undefined ? o.lat : num(r.latitude);
  const lon = o.lon !== undefined ? o.lon : num(r.longitude);
  const prec = o.prec !== undefined ? o.prec : r.precisaoGpsM ?? null;
  const fuso = o.fuso !== undefined ? o.fuso : r.fusoOffsetMin;
  const obs = o.obs !== undefined ? o.obs : r.observacao ?? null;
  const p = {
    latitude: lat, longitude: lon, motoristaId: r.motoristaId,
    deviceUuidUsado: r.deviceUuidUsado, observacao: obs,
    odometro: r.odometro ?? null, precisaoGpsM: prec, sequencial: r.sequencial,
    timestampEvento: new Date(r.timestampEvento).toISOString(), tipoEvento: r.tipoEvento,
  };
  if (fuso !== null && fuso !== undefined) p.fusoOffsetMin = fuso;
  return JSON.stringify(p);
}
const h = (r, o) => sha(`${r.hashAnterior}|${r.sequencial}|${canon(r, o)}`);

(async () => {
  const prisma = new PrismaClient();
  const regs = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL app.grupo_atual = '__sistema__'");
    return tx.registroJornada.findMany({ orderBy: [{ motoristaId: 'asc' }, { sequencial: 'asc' }] });
  });
  const saida = regs.map((r) => {
    const base = h(r);
    const variantes = {
      fusoNull: h(r, { fuso: null }),
      precisaoNull: h(r, { prec: null }),
      precisaoInteira: h(r, { prec: r.precisaoGpsM == null ? null : Math.round(r.precisaoGpsM) }),
      latLon6casas: h(r, { lat: num(r.latitude) == null ? null : +num(r.latitude).toFixed(6), lon: num(r.longitude) == null ? null : +num(r.longitude).toFixed(6) }),
      obsNull: h(r, { obs: null }),
    };
    const casou = Object.entries(variantes).filter(([, v]) => v === r.hashAtual).map(([k]) => k);
    return {
      sequencial: r.sequencial, tipoEvento: r.tipoEvento, motoristaId: r.motoristaId,
      latitudeBanco: String(r.latitude), longitudeBanco: String(r.longitude),
      precisaoGpsM: r.precisaoGpsM, fusoOffsetMin: r.fusoOffsetMin,
      observacao: r.observacao, odometro: r.odometro,
      timestampEvento: new Date(r.timestampEvento).toISOString(),
      hashAnterior: r.hashAnterior, hashAtual: r.hashAtual,
      canonicoRecalculado: canon(r),
      confere: base === r.hashAtual,
      variantesQueConferem: casou,
    };
  });
  console.log(JSON.stringify(saida, null, 2));
  await prisma.$disconnect();
})().catch((e) => { console.error(String(e.message || e).slice(0, 500)); process.exit(1); });
