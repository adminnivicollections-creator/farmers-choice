/**
 * Seed data compiled into the production image, so a fresh deployment can
 * bootstrap itself without shell access or dev dependencies.
 *
 * Everything here is idempotent (upserts). Nutrient recommendations are
 * deliberately absent -- those only enter through the sourced admin workflow.
 */
// No location tree. Villages come only from a real LGD import -- invented
// codes and hand-placed centroids would put a farmer in the wrong village.

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
  { key: 'can', name: 'Calcium Ammonium Nitrate', nPct: 25, p2o5Pct: 0, k2oPct: 0 },
  { key: 'sop',     name: 'SOP',             nPct: 0,  p2o5Pct: 0,  k2oPct: 50, sPct: 17 },
];
