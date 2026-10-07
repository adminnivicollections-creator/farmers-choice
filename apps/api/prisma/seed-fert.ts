/**
 * Fertilizer PRODUCT specifications. These are bag analyses printed by the
 * manufacturer and fixed by law -- they are not agronomic recommendations and
 * need no agricultural source.
 *
 * Note what is NOT here: a single nutrient recommendation. Those come only
 * through the admin workflow with a verified source attached. Until an
 * agronomist loads them, the calculator honestly reports "unavailable".
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PRODUCTS = [
  { key: 'urea',    name: 'Urea',            nameTe: 'యూరియా',   nameHi: 'यूरिया',   nPct: 46, p2o5Pct: 0,  k2oPct: 0 },
  { key: 'dap',     name: 'DAP',             nameTe: 'డీఏపీ',    nameHi: 'डीएपी',    nPct: 18, p2o5Pct: 46, k2oPct: 0 },
  { key: 'mop',     name: 'MOP',             nameTe: 'ఎంఓపీ',    nameHi: 'एमओपी',    nPct: 0,  p2o5Pct: 0,  k2oPct: 60 },
  { key: 'ssp',     name: 'SSP',             nameTe: 'ఎస్ఎస్పీ', nameHi: 'एसएसपी',   nPct: 0,  p2o5Pct: 16, k2oPct: 0, sPct: 11 },
  { key: 'tsp',     name: 'TSP',             nameTe: 'టీఎస్పీ',  nameHi: 'टीएसपी',   nPct: 0,  p2o5Pct: 46, k2oPct: 0 },
  { key: 'npk-10-26-26', name: 'NPK 10-26-26', nPct: 10, p2o5Pct: 26, k2oPct: 26 },
  { key: 'npk-12-32-16', name: 'NPK 12-32-16', nPct: 12, p2o5Pct: 32, k2oPct: 16 },
  { key: 'npk-20-20-0-13', name: 'NPK 20-20-0-13', nPct: 20, p2o5Pct: 20, k2oPct: 0, sPct: 13 },
  { key: 'mustard-can', name: 'Calcium Ammonium Nitrate', nPct: 25, p2o5Pct: 0, k2oPct: 0 },
  { key: 'sop',     name: 'SOP',             nPct: 0,  p2o5Pct: 0,  k2oPct: 50, sPct: 17 },
];

async function main() {
  for (const p of PRODUCTS) {
    await prisma.fertilizerProduct.upsert({ where: { key: p.key }, update: p, create: p });
  }
  const recs = await prisma.nutrientRecommendation.count({ where: { status: 'PUBLISHED' } });
  console.log(`seeded ${PRODUCTS.length} fertilizer products`);
  console.log(`published nutrient recommendations: ${recs}  <-- intentionally 0 until sourced data is loaded`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
