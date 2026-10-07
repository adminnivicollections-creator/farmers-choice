/**
 * Phase 1 seed — DEVELOPMENT DATA ONLY.
 *
 * Andhra Pradesh. The real LGD state code for AP is 28. Everything below that
 * is marked `DEMO-*` because those codes have NOT been verified against the
 * Local Government Directory. Do not ship them.
 *
 * Before the pilot, replace this with a real LGD import:
 *   1. Export district / sub-district / village CSVs for Andhra Pradesh from
 *      https://lgdirectory.gov.in  (Directory -> Download)
 *   2. Point `importLgdCsv()` at them. Village centroids are not in LGD --
 *      join against the Census village shapefile or geocode once and cache.
 *
 * AP was reorganised into 26 districts in 2022, so any district list predating
 * that is wrong. Pilot district here is Guntur: chilli, paddy and cotton
 * country, which matches the crops in the reference screens.
 *
 * Village centroids are approximate, hand-placed around the pilot mandals so
 * proximity queries have something plausible to sort. Good to roughly a
 * kilometre -- fine for development, not fine for launch.
 */
import { PrismaClient, LocationLevel } from '@prisma/client';

const prisma = new PrismaClient();

type Seed = {
  lgdCode: string;
  name: string;
  nameTe?: string;
  nameHi?: string;
  level: LocationLevel;
  lat?: number;
  lng?: number;
  pincode?: string;
  children?: Seed[];
};

const ANDHRA_PRADESH: Seed = {
  lgdCode: '28', // real LGD state code for Andhra Pradesh
  name: 'Andhra Pradesh',
  nameTe: 'ఆంధ్రప్రదేశ్',
  nameHi: 'आंध्र प्रदेश',
  level: 'STATE',
  children: [
    {
      lgdCode: 'DEMO-D-GUNTUR',
      name: 'Guntur',
      nameTe: 'గుంటూరు',
      nameHi: 'गुंटूर',
      level: 'DISTRICT',
      children: [
        {
          lgdCode: 'DEMO-M-TADIKONDA',
          name: 'Tadikonda',
          nameTe: 'తాడికొండ',
          nameHi: 'तड़ीकोंडा',
          level: 'MANDAL',
          children: [
            { lgdCode: 'DEMO-V-TADIKONDA', name: 'Tadikonda', nameTe: 'తాడికొండ', nameHi: 'तड़ीकोंडा', level: 'VILLAGE', lat: 16.4126, lng: 80.4019, pincode: '522236' },
            { lgdCode: 'DEMO-V-PEDAKAKANI', name: 'Pedakakani', nameTe: 'పెదకాకాని', nameHi: 'पेदाकाकानी', level: 'VILLAGE', lat: 16.3708, lng: 80.4604, pincode: '522509' },
            { lgdCode: 'DEMO-V-NAMBURU', name: 'Namburu', nameTe: 'నంబూరు', nameHi: 'नंबूरु', level: 'VILLAGE', lat: 16.3450, lng: 80.5012, pincode: '522508' },
            { lgdCode: 'DEMO-V-LAM', name: 'Lam', nameTe: 'లాం', nameHi: 'लाम', level: 'VILLAGE', lat: 16.3289, lng: 80.4467, pincode: '522034' },
          ],
        },
        {
          lgdCode: 'DEMO-M-MEDIKONDURU',
          name: 'Medikonduru',
          nameTe: 'మేడికొండూరు',
          nameHi: 'मेडिकोंडूरु',
          level: 'MANDAL',
          children: [
            { lgdCode: 'DEMO-V-MEDIKONDURU', name: 'Medikonduru', nameTe: 'మేడికొండూరు', nameHi: 'मेडिकोंडूरु', level: 'VILLAGE', lat: 16.3011, lng: 80.3356, pincode: '522438' },
            { lgdCode: 'DEMO-V-VEJENDLA', name: 'Vejendla', nameTe: 'వేజెండ్ల', nameHi: 'वेजेंडला', level: 'VILLAGE', lat: 16.2794, lng: 80.3702, pincode: '522438' },
          ],
        },
        {
          lgdCode: 'DEMO-M-PHIRANGIPURAM',
          name: 'Phirangipuram',
          nameTe: 'ఫిరంగిపురం',
          nameHi: 'फिरंगीपुरम',
          level: 'MANDAL',
          children: [
            { lgdCode: 'DEMO-V-PHIRANGIPURAM', name: 'Phirangipuram', nameTe: 'ఫిరంగిపురం', nameHi: 'फिरंगीपुरम', level: 'VILLAGE', lat: 16.2983, lng: 80.2578, pincode: '522529' },
            { lgdCode: 'DEMO-V-MUNNANGI', name: 'Munnangi', nameTe: 'మున్నంగి', nameHi: 'मुन्नंगी', level: 'VILLAGE', lat: 16.2641, lng: 80.2234, pincode: '522529' },
          ],
        },
      ],
    },
    {
      lgdCode: 'DEMO-D-KRISHNA',
      name: 'Krishna',
      nameTe: 'కృష్ణా',
      nameHi: 'कृष्णा',
      level: 'DISTRICT',
      children: [
        {
          lgdCode: 'DEMO-M-GANNAVARAM',
          name: 'Gannavaram',
          nameTe: 'గన్నవరం',
          nameHi: 'गन्नवरम',
          level: 'MANDAL',
          children: [
            { lgdCode: 'DEMO-V-GANNAVARAM', name: 'Gannavaram', nameTe: 'గన్నవరం', nameHi: 'गन्नवरम', level: 'VILLAGE', lat: 16.5370, lng: 80.8050, pincode: '521101' },
            { lgdCode: 'DEMO-V-KESARAPALLI', name: 'Kesarapalli', nameTe: 'కేసరపల్లి', nameHi: 'केसरपल्ली', level: 'VILLAGE', lat: 16.5192, lng: 80.7831, pincode: '521101' },
          ],
        },
      ],
    },
  ],
};

/** Andhra Pradesh kharif/rabi staples. Names are used in the crop picker. */
const CROPS = [
  { slug: 'paddy', nameEn: 'Paddy', nameTe: 'వరి', nameHi: 'धान' },
  { slug: 'chilli', nameEn: 'Chilli', nameTe: 'మిరప', nameHi: 'मिर्च' },
  { slug: 'cotton', nameEn: 'Cotton', nameTe: 'పత్తి', nameHi: 'कपास' },
  { slug: 'maize', nameEn: 'Maize', nameTe: 'మొక్కజొన్న', nameHi: 'मक्का' },
  { slug: 'turmeric', nameEn: 'Turmeric', nameTe: 'పసుపు', nameHi: 'हल्दी' },
  { slug: 'redgram', nameEn: 'Red gram', nameTe: 'కంది', nameHi: 'अरहर' },
  { slug: 'groundnut', nameEn: 'Groundnut', nameTe: 'వేరుశనగ', nameHi: 'मूंगफली' },
  { slug: 'sugarcane', nameEn: 'Sugarcane', nameTe: 'చెరకు', nameHi: 'गन्ना' },
  { slug: 'soybean', nameEn: 'Soybean', nameTe: 'సోయాబీన్', nameHi: 'सोयाबीन' },
  { slug: 'vegetables', nameEn: 'Vegetables', nameTe: 'కూరగాయలు', nameHi: 'सब्ज़ियाँ' },
];

async function insertTree(node: Seed, parentId: string | null): Promise<number> {
  const row = await prisma.location.upsert({
    where: { lgdCode: node.lgdCode },
    update: { name: node.name, nameTe: node.nameTe, nameHi: node.nameHi, parentId, pincode: node.pincode },
    create: {
      lgdCode: node.lgdCode,
      name: node.name,
      nameTe: node.nameTe,
      nameHi: node.nameHi,
      level: node.level,
      parentId,
      pincode: node.pincode,
    },
  });

  // Prisma has no type for PostGIS geography, so the centroid goes in raw.
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

async function main() {
  const locations = await insertTree(ANDHRA_PRADESH, null);

  for (const c of CROPS) {
    await prisma.crop.upsert({ where: { slug: c.slug }, update: c, create: c });
  }

  const villages = await prisma.location.count({ where: { level: 'VILLAGE' } });
  console.log(`seeded ${locations} locations (${villages} villages), ${CROPS.length} crops`);
  console.log('NOTE: all codes except state 28 (Andhra Pradesh) are DEMO placeholders — replace before pilot.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
