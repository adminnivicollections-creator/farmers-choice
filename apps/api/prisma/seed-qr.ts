/**
 * DEMO QR tags — development only. Real tags are issued by manufacturers and
 * equipment owners; these exist so the scanner has something to resolve.
 * Codes are prefixed DEMO so they are obvious in any log or database dump.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const TAGS = [
  {
    code: 'DEMOseedMTU1010batchA',
    type: 'PRODUCT_BATCH' as const,
    payload: {
      productName: 'Paddy Seeds (MTU 1010)',
      manufacturer: 'Sri Sai Agro',
      batchNo: 'MTU1010-2026-A',
      packedOn: '2026-06-14',
      packSize: '1 kg',
      note: 'DEMO DATA — not a real batch',
    },
  },
  {
    code: 'DEMOneemOilGreenGrow01',
    type: 'PRODUCT_BATCH' as const,
    payload: {
      productName: 'Organic Neem Oil',
      manufacturer: 'GreenGrow',
      batchNo: 'NEEM-2026-11',
      packedOn: '2026-08-02',
      packSize: '1 L',
      note: 'DEMO DATA — not a real batch',
    },
  },
  {
    code: 'DEMOrecalledBatchXYZ99',
    type: 'PRODUCT_BATCH' as const,
    payload: { productName: 'Hybrid Chilli Seed', manufacturer: 'Unknown', batchNo: 'X-99', note: 'DEMO recalled batch' },
    revokedAt: new Date('2026-09-01'),
  },
  {
    code: 'DEMOtractorMahindra575',
    type: 'EQUIPMENT' as const,
    payload: {
      equipmentName: 'Tractor - Mahindra 575 DI',
      ownerName: 'Ramesh Kumar',
      note: 'DEMO DATA — equipment records land in Phase 2',
    },
  },
];

async function main() {
  for (const t of TAGS) {
    await prisma.qrTag.upsert({ where: { code: t.code }, update: t, create: t });
  }
  console.log(`seeded ${TAGS.length} DEMO qr tags`);
  console.log('scan string format: FC1:<code>  e.g. FC1:DEMOseedMTU1010batchA');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
