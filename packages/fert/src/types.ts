/**
 * Fertilizer calculator types.
 *
 * The governing rule of this package: it converts nutrients into products.
 * It never decides how much nutrient a crop needs. That number comes from a
 * sourced recommendation row and is passed in. There is no default, no
 * fallback and no "typical" value anywhere in this code.
 */

export type Nutrients = {
  /** kg of elemental N */
  n: number;
  /** kg of P2O5, not elemental P */
  p2o5: number;
  /** kg of K2O, not elemental K */
  k2o: number;
};

export type RecommendationType = 'GENERAL' | 'SOIL_TEST' | 'STCR';

/** What an authority actually published, per hectare. */
export type NutrientRecommendation = {
  id: string;
  perHectare: Nutrients;
  type: RecommendationType;
  /** Present only when the authority published stage-wise splits. */
  schedule?: ApplicationStage[];
  source: RecommendationSource;
};

export type ApplicationStage = {
  /** "Basal", "First top dressing", ... exactly as the source words it. */
  stage: string;
  daysAfterSowing?: number | null;
  /** Share of each nutrient applied at this stage, 0-1. */
  share: Partial<Nutrients>;
};

/** Without every one of these fields the recommendation is not publishable. */
export type RecommendationSource = {
  organisation: string;
  document: string;
  url?: string | null;
  page?: string | null;
  region: string;
  publishedOn?: string | null;
  verifiedOn: string;
  version: string;
};

export type FertilizerProduct = {
  id: string;
  name: string;
  /** Nutrient content as a PERCENTAGE, e.g. urea n = 46. */
  n: number;
  p2o5: number;
  k2o: number;
  s?: number;
  /** Rupees per kg, when a current price is known. Optional on purpose. */
  pricePerKg?: number | null;
};

export type ProductDose = {
  product: FertilizerProduct;
  kg: number;
  supplies: Nutrients;
  cost?: number | null;
};

export type Blend = {
  doses: ProductDose[];
  supplied: Nutrients;
  required: Nutrients;
  /** supplied - required, never below zero. Lower is better. */
  excess: Nutrients;
  shortfall: Nutrients;
  totalKg: number;
  totalCost: number | null;
  /** Human-readable working, for the "How was this calculated?" panel. */
  workings: string[];
};
