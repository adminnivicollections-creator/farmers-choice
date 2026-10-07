/**
 * One-shot bootstrap for a fresh deployment: PostGIS extensions, locations,
 * crops, fertilizer products, demo QR tags.
 *
 * Deliberately does NOT seed nutrient recommendations -- those only enter
 * through the sourced admin workflow.
 */
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS btree_gist');
  console.log('extensions ok');

  for (const script of ['seed.ts', 'seed-fert.ts', 'seed-qr.ts']) {
    console.log(`\n--- ${script}`);
    execSync(`npx tsx prisma/${script}`, { stdio: 'inherit' });
  }

  const recs = await prisma.nutrientRecommendation.count({ where: { status: 'PUBLISHED' } });
  console.log(`\npublished nutrient recommendations: ${recs} (expected 0 until ANGRAU data is loaded)`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
