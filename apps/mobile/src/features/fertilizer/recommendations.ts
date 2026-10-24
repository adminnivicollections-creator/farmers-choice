/**
 * Official fertilizer recommendations for Andhra Pradesh, copied as printed.
 * Every row names its document and page. Nothing here is estimated: a crop
 * with no official figure is simply absent.
 *
 * NOT YET CHECKED BY AN AGRONOMIST. Set `verified` only after someone
 * qualified compares the row against the source page.
 *
 * Left out on purpose:
 *  - Cotton, chilli, groundnut, turmeric: no official per-acre figure found.
 *  - Paddy, Scarce Rainfall zone: CESS Table 3.12 prints N 240 kg/ha, which
 *    looks like a misprint -- confirm in the Vyavasaya Panchangam first.
 *  - Bengal gram: CESS (ANGRAU) gives 50:125:- kg/ha, ICAR gives 20 N +
 *    50 P2O5 + 40 S kg/ha. Sources disagree.
 *  - Red gram also differs (ICAR p.10: 25-30 : 40-50 : 30 kg/ha); the
 *    ANGRAU figure below is used because ANGRAU is the state authority.
 */

/** [min, max] kg of nutrient. Equal when the source gives one number. */
export type Range = [number, number];

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
  source: string;
  verified: false;
};

const CESS =
  'ANGRAU Vyavasaya Panchangam, as reproduced in CESS, "Fertiliser Consumption, Costs and Returns ' +
  'from Agriculture in Andhra Pradesh 2023-24 & 2024-25" (Mar 2026), p.59';
const ICAR = 'ICAR Kharif Agro-Advisory for Farmers 2025, Andhra Pradesh chapter';

export const RECS: Rec[] = [
  // Paddy, Kharif, by agro-climatic zone. CESS Table 3.12.
  { crop: 'paddy', variant: 'krishna', n: [80, 90], p2o5: [60, 60], k2o: [40, 60], per: 'ha', source: `${CESS}, Table 3.12`, verified: false },
  { crop: 'paddy', variant: 'godavari', n: [90, 90], p2o5: [60, 60], k2o: [60, 60], per: 'ha', source: `${CESS}, Table 3.12`, verified: false },
  { crop: 'paddy', variant: 'southern', n: [80, 80], p2o5: [60, 60], k2o: [40, 40], per: 'ha', source: `${CESS}, Table 3.12`, verified: false },
  { crop: 'paddy', variant: 'northCoastal', n: [80, 80], p2o5: [60, 60], k2o: [40, 50], per: 'ha', source: `${CESS}, Table 3.12`, verified: false },
  { crop: 'paddy', variant: 'hat', n: [80, 80], p2o5: [60, 60], k2o: [50, 50], per: 'ha', source: `${CESS}, Table 3.12`, verified: false },

  // CESS Table 3.13 ("K: -" = no recommendation, i.e. none applied).
  { crop: 'maize', n: [182, 182], p2o5: [60, 60], k2o: [50, 50], per: 'ha', source: `${CESS}, Table 3.13`, verified: false },
  { crop: 'ragi', n: [60, 60], p2o5: [30, 30], k2o: [20, 20], per: 'ha', source: `${CESS}, Table 3.13`, verified: false },
  { crop: 'redgram', n: [20, 20], p2o5: [50, 50], k2o: [0, 0], per: 'ha', source: `${CESS}, Table 3.13`, verified: false },
  { crop: 'blackgram', n: [20, 20], p2o5: [50, 50], k2o: [0, 0], per: 'ha', source: `${CESS}, Table 3.13`, verified: false },

  // ICAR advisory, Andhra Pradesh chapter.
  { crop: 'jowar', variant: 'irrigated', n: [32, 40], p2o5: [24, 24], k2o: [16, 16], per: 'acre', source: `${ICAR}, Jowar, p.12`, verified: false },
  { crop: 'jowar', variant: 'rainfed', n: [24, 32], p2o5: [16, 16], k2o: [12, 12], per: 'acre', source: `${ICAR}, Jowar, p.12`, verified: false },
  { crop: 'sugarcane', n: [67, 67], p2o5: [40, 40], k2o: [48, 48], per: 'acre', source: `${ICAR}, Sugarcane, p.12`, verified: false },
  { crop: 'sesame', n: [16, 16], p2o5: [8, 8], k2o: [8, 8], per: 'acre', source: `${ICAR}, Sesamum, p.9`, verified: false },
];

const ACRES_PER_HA = 2.4710538;

/** Bag analyses fixed by law: urea 46% N, DAP 18% N + 46% P2O5, MOP 60% K2O. */
const UREA_N = 0.46, DAP_N = 0.18, DAP_P = 0.46, MOP_K = 0.6;

export type Products = { dap: Range; urea: Range; mop: Range };

/**
 * Per-acre kg of the three common bags. DAP covers phosphorus first; the
 * nitrogen DAP already brings is subtracted before urea is dosed, or the
 * farmer over-applies nitrogen.
 */
export function productsPerAcre(rec: Rec): Products {
  const f = rec.per === 'ha' ? 1 / ACRES_PER_HA : 1;
  const at = (i: 0 | 1) => {
    const dap = (rec.p2o5[i] * f) / DAP_P;
    const urea = Math.max(0, rec.n[i] * f - dap * DAP_N) / UREA_N;
    const mop = (rec.k2o[i] * f) / MOP_K;
    return { dap, urea, mop };
  };
  const lo = at(0), hi = at(1);
  return {
    dap: [lo.dap, hi.dap],
    urea: [lo.urea, hi.urea],
    mop: [lo.mop, hi.mop],
  };
}
