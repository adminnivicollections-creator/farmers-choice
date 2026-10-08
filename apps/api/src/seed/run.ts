/**
 * Bootstrap seed for a fresh deployment. Runs when SEED_ON_BOOT=true.
 * Idempotent: safe to leave on, cheap to run twice, but turn it off once the
 * first deploy is green so boots stay fast.
 */
import { PrismaClient } from '@prisma/client';
import { ANDHRA_PRADESH, CROPS, PRODUCTS, TAGS, Seed } from './data';

const prisma = new PrismaClient();

async function insertTree(node: Seed, parentId: string | null): Promise<number> {
  const row = await prisma.location.upsert({
    where: { lgdCode: node.lgdCode },
    update: { name: node.name, nameTe: node.nameTe, nameHi: node.nameHi, parentId, pincode: node.pincode },
    create: {
      lgdCode: node.lgdCode, name: node.name, nameTe: node.nameTe, nameHi: node.nameHi,
      level: node.level, parentId, pincode: node.pincode,
    },
  });

  if (node.lat != null && node.lng != null) {
    await prisma.$executeRaw`
      UPDATE "Location"
      SET centroid = ST_SetSRID(ST_MakePoint(${node.lng}, ${node.lat}), 4326)::geography
      WHERE id = ${row.id}`;
  }

  let n = 1;
  for (const child of node.children ?? []) n += await insertTree(child, row.id);
  return n;
}

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

  const locations = await insertTree(ANDHRA_PRADESH, null);
  for (const c of CROPS) await prisma.crop.upsert({ where: { slug: c.slug }, update: c, create: c });
  for (const p of PRODUCTS) await prisma.fertilizerProduct.upsert({ where: { key: p.key }, update: p, create: p });
  for (const t of TAGS) await prisma.qrTag.upsert({ where: { code: t.code }, update: t, create: t });

  const recs = await prisma.nutrientRecommendation.count({ where: { status: 'PUBLISHED' } });
  console.log(
    `seeded: ${locations} locations, ${CROPS.length} crops, ` +
    `${PRODUCTS.length} fertilizer products, ${TAGS.length} demo qr tags`,
  );
  console.log(`published nutrient recommendations: ${recs} (0 is expected until ANGRAU data is loaded)`);
}

if (require.main === module) {
  seed()
    .catch((e) => { console.error('seed failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
