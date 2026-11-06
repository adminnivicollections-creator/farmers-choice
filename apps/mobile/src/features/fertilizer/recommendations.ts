/**
 * Official fertilizer recommendations for Andhra Pradesh, copied as printed.
 * Every row names its document and page. Nothing here is estimated: a crop
 * with no official figure is simply absent, and so is any timing the source
 * doesn't state.
 *
 * NOT YET CHECKED BY AN AGRONOMIST. Set `verified` only after someone
 * qualified compares the row against the source page (see
 * docs/agronomist-review.md).
 *
 * Left out on purpose:
 *  - Chilli: the only official AP-relevant guide found (ICAR-IISR, 2019) has
 *    its dose lines in an unreadable font encoding.
 *  - Paddy, Scarce Rainfall zone: CESS Table 3.12 prints N 240 kg/ha, which
 *    looks like a misprint -- confirm in the Vyavasaya Panchangam first.
 *  - Bengal gram: CESS (ANGRAU) gives 50:125:- kg/ha, ICAR gives 20 N +
 *    50 P2O5 + 40 S kg/ha. Sources disagree.
 *  - Red gram also differs (ICAR p.10: 25-30 : 40-50 : 30 kg/ha); the
 *    ANGRAU figure below is used because ANGRAU is the state authority.
 *  - Cotton in Rayalaseema/Telangana and desi or American varieties: the
 *    source has them, but Guntur farmers grow hybrids, and fewer rows keep
 *    the picker simple.
 */

/** [min, max] kg of nutrient. Equal when the source gives one number. */
export type Range = [number, number];

/** One application: a share of the nutrient, and when it goes on. */
export type Split =
  | { share: number; at: 'basal' | 'flowering' }
  | { share: number; days: number; after: 'sowing' | 'planting' };

export type Rec = {
  /** i18n key under fert.crop_* */
  crop: string;
  /** Only for crops whose dose differs by zone or condition. i18n key under fert.zone_* */
  variant?: string;
  n: Range;
  p2o5: Range;
  k2o: Range;
  /** The unit the source printed in. Converted, never re-typed. */
  per: 'ha' | 'acre';
  /** The phosphate the source names. DAP unless it says otherwise. */
  phosphate?: 'dap' | 'ssp';
  /** Gypsum the source prescribes, in the same unit as the nutrients. */
  gypsum?: number;
  /** When each nutrient goes on, only where the source says. */
  timing?: { n?: Split[]; p?: Split[]; k?: Split[]; gypsum?: Split[] };
  source: string;
  verified: false;
};

const CESS =
  'ANGRAU Vyavasaya Panchangam, as reproduced in CESS, "Fertiliser Consumption, Costs and Returns ' +
  'from Agriculture in Andhra Pradesh 2023-24 & 2024-25" (Mar 2026), p.59';
const ICAR = 'ICAR Kharif Agro-Advisory for Farmers 2025, Andhra Pradesh chapter';
const COTTON = 'Approved Package of Practices for cotton: Andhra Pradesh (c. 2007, copy in the TNAU cotton database), p.3';
const GROUNDNUT = "ICAR-IIGR, Package of practices (PoP's) of groundnut for different states: Andhra Pradesh, p.1";
const TURMERIC = 'ICAR-IISR, Turmeric: Good Agricultural Practices (Sept 2019), p.8';

const BASAL: Split[] = [{ share: 1, at: 'basal' }];

export const RECS: Rec[] = [
  // Paddy, Kharif, by agro-climatic zone. CESS Table 3.12. Timing: ICAR p.7
  // says the entire phosphorus goes on at final puddling; N and K timing
  // depends on soil and isn't given as a schedule.
  ...([
    ['krishna', [80, 90], [60, 60], [40, 60]],
    ['godavari', [90, 90], [60, 60], [60, 60]],
    ['southern', [80, 80], [60, 60], [40, 40]],
    ['northCoastal', [80, 80], [60, 60], [40, 50]],
    ['hat', [80, 80], [60, 60], [50, 50]],
  ] as [string, Range, Range, Range][]).map(([variant, n, p2o5, k2o]): Rec => ({
    crop: 'paddy', variant, n, p2o5, k2o, per: 'ha',
    timing: { p: BASAL },
    source: `${CESS}, Table 3.12; timing ${ICAR}, p.7`, verified: false,
  })),

  // CESS Table 3.13 ("K: -" = no recommendation, i.e. none applied).
  { crop: 'maize', n: [182, 182], p2o5: [60, 60], k2o: [50, 50], per: 'ha', source: `${CESS}, Table 3.13`, verified: false },
  { crop: 'ragi', n: [60, 60], p2o5: [30, 30], k2o: [20, 20], per: 'ha', source: `${CESS}, Table 3.13`, verified: false },
  // Pulses: ICAR p.10 says all fertilizer goes on basally, at sowing.
  { crop: 'redgram', n: [20, 20], p2o5: [50, 50], k2o: [0, 0], per: 'ha', timing: { n: BASAL, p: BASAL }, source: `${CESS}, Table 3.13; timing ${ICAR}, p.10`, verified: false },
  { crop: 'blackgram', n: [20, 20], p2o5: [50, 50], k2o: [0, 0], per: 'ha', timing: { n: BASAL, p: BASAL }, source: `${CESS}, Table 3.13; timing ${ICAR}, p.10`, verified: false },

  // ICAR advisory, Andhra Pradesh chapter.
  { crop: 'jowar', variant: 'irrigated', n: [32, 40], p2o5: [24, 24], k2o: [16, 16], per: 'acre', source: `${ICAR}, Jowar, p.12`, verified: false },
  { crop: 'jowar', variant: 'rainfed', n: [24, 32], p2o5: [16, 16], k2o: [12, 12], per: 'acre', source: `${ICAR}, Jowar, p.12`, verified: false },
  {
    crop: 'sugarcane', n: [67, 67], p2o5: [40, 40], k2o: [48, 48], per: 'acre',
    // P and K basal at planting; N in two equal splits at 45 and 90 days.
    timing: { p: BASAL, k: BASAL, n: [{ share: 0.5, days: 45, after: 'planting' }, { share: 0.5, days: 90, after: 'planting' }] },
    source: `${ICAR}, Sugarcane, p.12`, verified: false,
  },
  { crop: 'sesame', n: [16, 16], p2o5: [8, 8], k2o: [8, 8], per: 'acre', source: `${ICAR}, Sesamum, p.9`, verified: false },

  // Cotton hybrids, Coastal AP (Guntur). Phosphorus basal; nitrogen in two
  // splits at 30 and 60 days. The source gives no potash timing for this region.
  ...([['coastalHybrid', [48, 48]], ['riceFallowHybrid', [60, 60]]] as [string, Range][]).map(([variant, n]): Rec => ({
    crop: 'cotton', variant, n, p2o5: [24, 24], k2o: [24, 24], per: 'acre',
    timing: { p: BASAL, n: [{ share: 0.5, days: 30, after: 'sowing' }, { share: 0.5, days: 60, after: 'sowing' }] },
    source: COTTON, verified: false,
  })),

  // Groundnut: phosphorus through SSP (it also supplies the crop's sulphur and
  // calcium), all basal; gypsum 500 kg/ha at flowering. Rabi adds 10 kg N at flowering.
  {
    crop: 'groundnut', variant: 'kharif', n: [20, 20], p2o5: [40, 40], k2o: [50, 50], per: 'ha',
    phosphate: 'ssp', gypsum: 500,
    timing: { n: BASAL, p: BASAL, k: BASAL, gypsum: [{ share: 1, at: 'flowering' }] },
    source: GROUNDNUT, verified: false,
  },
  {
    crop: 'groundnut', variant: 'rabi', n: [30, 30], p2o5: [40, 40], k2o: [50, 50], per: 'ha',
    phosphate: 'ssp', gypsum: 500,
    timing: {
      n: [{ share: 2 / 3, at: 'basal' }, { share: 1 / 3, at: 'flowering' }],
      p: BASAL, k: BASAL, gypsum: [{ share: 1, at: 'flowering' }],
    },
    source: GROUNDNUT, verified: false,
  },

  // Turmeric, AP and Telangana soils. Phosphorus basal; N and K in equal
  // splits at 45, 90 and 120 days after planting (the source says "2-3 split
  // doses ... at 45, 90 (and 120) DAP"; the app shows all three).
  {
    crop: 'turmeric', n: [300, 300], p2o5: [125, 125], k2o: [200, 200], per: 'ha',
    timing: {
      p: BASAL,
      n: [45, 90, 120].map((days) => ({ share: 1 / 3, days, after: 'planting' as const })),
      k: [45, 90, 120].map((days) => ({ share: 1 / 3, days, after: 'planting' as const })),
    },
    source: TURMERIC, verified: false,
  },
];

const ACRES_PER_HA = 2.4710538;

/**
 * Bag analyses fixed by law: urea 46% N, DAP 18% N + 46% P2O5,
 * SSP 16% P2O5, MOP 60% K2O.
 */
const UREA_N = 0.46, DAP_N = 0.18, DAP_P = 0.46, SSP_P = 0.16, MOP_K = 0.6;

export type ProductKey = 'dap' | 'ssp' | 'urea' | 'mop' | 'gypsum';
export type ProductDose = { key: ProductKey; perAcre: Range; timing?: Split[] };

/**
 * Per-acre kg of each bag to buy, in the order they go on. The phosphate
 * covers phosphorus first; any nitrogen it already brings (DAP) is subtracted
 * before urea is dosed, or the farmer over-applies nitrogen.
 */
export function productsPerAcre(rec: Rec): ProductDose[] {
  const f = rec.per === 'ha' ? 1 / ACRES_PER_HA : 1;
  const ssp = rec.phosphate === 'ssp';
  const at = (i: 0 | 1) => {
    const phosphate = (rec.p2o5[i] * f) / (ssp ? SSP_P : DAP_P);
    const nFromPhosphate = ssp ? 0 : phosphate * DAP_N;
    return {
      phosphate,
      urea: Math.max(0, rec.n[i] * f - nFromPhosphate) / UREA_N,
      mop: (rec.k2o[i] * f) / MOP_K,
    };
  };
  const lo = at(0), hi = at(1);
  const doses: ProductDose[] = [
    { key: ssp ? 'ssp' : 'dap', perAcre: [lo.phosphate, hi.phosphate], timing: rec.timing?.p },
    { key: 'urea', perAcre: [lo.urea, hi.urea], timing: rec.timing?.n },
    { key: 'mop', perAcre: [lo.mop, hi.mop], timing: rec.timing?.k },
  ];
  if (rec.gypsum) doses.push({ key: 'gypsum', perAcre: [rec.gypsum * f, rec.gypsum * f], timing: rec.timing?.gypsum });
  // Under half a kilo an acre rounds to nothing: don't send a farmer to buy
  // a bag for it (red gram: DAP's own nitrogen leaves 0.3 kg of urea).
  return doses.filter((d) => d.perAcre[1] >= 0.5);
}
