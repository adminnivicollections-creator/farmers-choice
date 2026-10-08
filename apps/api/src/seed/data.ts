/**
 * Seed data compiled into the production image, so a fresh deployment can
 * bootstrap itself without shell access or dev dependencies.
 *
 * Everything here is idempotent (upserts). Nutrient recommendations are
 * deliberately absent -- those only enter through the sourced admin workflow.
 */
import { LocationLevel } from '@prisma/client';

export type Seed = {
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

export const ANDHRA_PRADESH: Seed = {
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


export const CROPS = [
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


export const PRODUCTS = [
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


export const TAGS = [
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

