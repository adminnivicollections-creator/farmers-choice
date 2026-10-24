/**
 * Crops for the picker. Reference names only -- no agronomic numbers.
 *
 * Locations are deliberately NOT seeded. Villages must come from a real LGD
 * import (https://lgdirectory.gov.in -> Directory -> Download, with centroids
 * from the Census village shapefile); invented codes and hand-placed
 * centroids would assign farmers to the wrong village.
 */
import { PrismaClient } from '@prisma/client';
import { CROPS } from '../src/seed/data';

const prisma = new PrismaClient();

async function main() {
  for (const c of CROPS) {
    await prisma.crop.upsert({ where: { slug: c.slug }, update: c, create: c });
  }
  console.log(`seeded ${CROPS.length} crops`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
