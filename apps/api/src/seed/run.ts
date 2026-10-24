/**
 * Bootstrap seed for a fresh deployment. Runs when SEED_ON_BOOT=true.
 * Idempotent: safe to leave on, cheap to run twice, but turn it off once the
 * first deploy is green so boots stay fast.
 */
import { PrismaClient } from '@prisma/client';
import { CROPS, PRODUCTS } from './data';
import { loadRecommendations } from './load-recommendations';

const prisma = new PrismaClient();

export async function seed() {
  // PostGIS must exist before any geography column is written. On Supabase
  // these are usually already enabled; this makes a bare Postgres work too.
  for (const ext of ['postgis', 'btree_gist']) {
    try {
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS ${ext}`);
    } catch (e) {
      console.warn(`could not create extension ${ext}: ${e}`);
    }
  }

  for (const c of CROPS) await prisma.crop.upsert({ where: { slug: c.slug }, update: c, create: c });
  for (const p of PRODUCTS) await prisma.fertilizerProduct.upsert({ where: { key: p.key }, update: p, create: p });

  await loadRecommendations(prisma);

  const recs = await prisma.nutrientRecommendation.count({ where: { status: 'PUBLISHED' } });
  console.log(
    `seeded: ${CROPS.length} crops, ${PRODUCTS.length} fertilizer products ` +
    '(no locations: villages come only from a real LGD import)',
  );
  console.log(`published nutrient recommendations: ${recs} (0 is expected until ANGRAU data is loaded)`);
}

if (require.main === module) {
  seed()
    .catch((e) => { console.error('seed failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
