import {
  Blend, FertilizerProduct, NutrientRecommendation, Nutrients, ProductDose,
} from './types';

/** Hectares per unit. Only units whose factor is exact and universal live here. */
export const HECTARES_PER = {
  hectare: 1,
  acre: 0.40468564224, // exact: 1 acre = 4046.8564224 m2
  gunta: 0.40468564224 / 40, // 1 acre = 40 guntas, by definition
  cent: 0.40468564224 / 100,
  sqm: 1 / 10_000,
} as const;

export type AreaUnit = keyof typeof HECTARES_PER;

/**
 * Bigha is deliberately absent. It is not a fixed unit -- it differs by state
 * and sometimes by district, so a single factor would be a fabricated number.
 * Supply a verified, region-specific factor through `toHectares` instead.
 */
export function toHectares(value: number, unit: AreaUnit): number;
export function toHectares(value: number, unit: 'custom', hectaresPerUnit: number): number;
export function toHectares(value: number, unit: AreaUnit | 'custom', hectaresPerUnit?: number): number {
  if (unit === 'custom') {
    if (!hectaresPerUnit || hectaresPerUnit <= 0) {
      throw new Error('A custom area unit needs a verified hectares-per-unit factor');
    }
    return value * hectaresPerUnit;
  }
  return value * HECTARES_PER[unit];
}

const ZERO: Nutrients = { n: 0, p2o5: 0, k2o: 0 };
const add = (a: Nutrients, b: Nutrients): Nutrients => ({
  n: a.n + b.n, p2o5: a.p2o5 + b.p2o5, k2o: a.k2o + b.k2o,
});
const clampedDiff = (a: Nutrients, b: Nutrients): Nutrients => ({
  n: Math.max(0, a.n - b.n), p2o5: Math.max(0, a.p2o5 - b.p2o5), k2o: Math.max(0, a.k2o - b.k2o),
});
const total = (x: Nutrients) => x.n + x.p2o5 + x.k2o;

/** Scale a per-hectare recommendation to the farmer's actual field. */
export function requirementFor(rec: NutrientRecommendation, hectares: number): Nutrients {
  if (hectares <= 0) throw new Error('Field area must be greater than zero');
  return {
    n: rec.perHectare.n * hectares,
    p2o5: rec.perHectare.p2o5 * hectares,
    k2o: rec.perHectare.k2o * hectares,
  };
}

/** What `kg` of a product actually delivers. Percentages, so divide by 100. */
export function supplies(product: FertilizerProduct, kg: number): Nutrients {
  return {
    n: (kg * product.n) / 100,
    p2o5: (kg * product.p2o5) / 100,
    k2o: (kg * product.k2o) / 100,
  };
}

const dose = (product: FertilizerProduct, kg: number): ProductDose => ({
  product,
  kg,
  supplies: supplies(product, kg),
  cost: product.pricePerKg != null ? kg * product.pricePerKg : null,
});

/**
 * Solve one combination of products for a nutrient requirement.
 *
 * Order matters and is not arbitrary: phosphorus sources (DAP, complexes)
 * almost always carry nitrogen too, so P is satisfied first, then K, and
 * whatever nitrogen those products already contributed is SUBTRACTED before
 * the straight-N product is dosed. That subtraction is the whole reason this
 * is not just three independent divisions -- without it the farmer
 * over-applies nitrogen on every single calculation.
 */
export function solveWith(
  required: Nutrients,
  products: { p?: FertilizerProduct; k?: FertilizerProduct; n?: FertilizerProduct },
): Blend {
  const doses: ProductDose[] = [];
  const workings: string[] = [];
  let supplied: Nutrients = { ...ZERO };

  const push = (d: ProductDose, why: string) => {
    if (d.kg <= 1e-9) return;
    doses.push(d);
    supplied = add(supplied, d.supplies);
    workings.push(why);
  };

  // 1. Phosphorus
  if (required.p2o5 > 0 && products.p && products.p.p2o5 > 0) {
    const kg = required.p2o5 / (products.p.p2o5 / 100);
    const d = dose(products.p, kg);
    push(d,
      `${products.p.name}: ${required.p2o5.toFixed(1)} kg P2O5 needed / ${products.p.p2o5}% ` +
      `= ${kg.toFixed(1)} kg. This also supplies ${d.supplies.n.toFixed(1)} kg N` +
      (d.supplies.k2o > 0 ? ` and ${d.supplies.k2o.toFixed(1)} kg K2O` : '') + '.');
  }

  // 2. Potassium, counting anything the P product already gave
  const kStillNeeded = Math.max(0, required.k2o - supplied.k2o);
  if (kStillNeeded > 0 && products.k && products.k.k2o > 0) {
    const kg = kStillNeeded / (products.k.k2o / 100);
    const d = dose(products.k, kg);
    push(d,
      `${products.k.name}: ${kStillNeeded.toFixed(1)} kg K2O still needed / ${products.k.k2o}% ` +
      `= ${kg.toFixed(1)} kg.`);
  }

  // 3. Nitrogen last, net of what steps 1 and 2 already supplied
  const nStillNeeded = Math.max(0, required.n - supplied.n);
  if (nStillNeeded > 0 && products.n && products.n.n > 0) {
    const kg = nStillNeeded / (products.n.n / 100);
    const d = dose(products.n, kg);
    push(d,
      `${products.n.name}: ${required.n.toFixed(1)} kg N needed minus ` +
      `${(required.n - nStillNeeded).toFixed(1)} kg already supplied = ${nStillNeeded.toFixed(1)} kg, ` +
      `/ ${products.n.n}% = ${kg.toFixed(1)} kg.`);
  }

  const costs = doses.map((d) => d.cost);
  return {
    doses,
    supplied,
    required,
    excess: clampedDiff(supplied, required),
    shortfall: clampedDiff(required, supplied),
    totalKg: doses.reduce((t, d) => t + d.kg, 0),
    totalCost: costs.every((c) => c != null) && costs.length > 0
      ? (costs as number[]).reduce((a, b) => a + b, 0)
      : null,
    workings,
  };
}

/**
 * Try every sensible combination of the products the farmer can actually get,
 * and rank them. Nothing here assumes urea + DAP + MOP; that combination only
 * wins if it wins on the numbers.
 *
 * Ranking: no shortfall first, then least excess nutrient, then cost when
 * every product in the blend has a known price, then fewest products to buy.
 */
export function rankBlends(required: Nutrients, available: FertilizerProduct[]): Blend[] {
  const pSources = available.filter((p) => p.p2o5 > 0);
  const kSources = available.filter((p) => p.k2o > 0);
  const nSources = available.filter((p) => p.n > 0);

  const candidates: Blend[] = [];
  const seen = new Set<string>();

  const pOpts: (FertilizerProduct | undefined)[] = required.p2o5 > 0 ? pSources : [undefined];
  const kOpts: (FertilizerProduct | undefined)[] = required.k2o > 0 ? kSources : [undefined];
  const nOpts: (FertilizerProduct | undefined)[] = required.n > 0 ? nSources : [undefined];

  for (const p of pOpts) {
    for (const k of kOpts) {
      for (const n of nOpts) {
        const blend = solveWith(required, { p, k, n });
        const key = blend.doses.map((d) => `${d.product.id}:${d.kg.toFixed(2)}`).sort().join('|');
        if (!key || seen.has(key)) continue;
        seen.add(key);
        candidates.push(blend);
      }
    }
  }

  return candidates.sort((a, b) => {
    const sa = total(a.shortfall), sb = total(b.shortfall);
    if (Math.abs(sa - sb) > 1e-6) return sa - sb;

    const ea = total(a.excess), eb = total(b.excess);
    if (Math.abs(ea - eb) > 1e-6) return ea - eb;

    if (a.totalCost != null && b.totalCost != null && Math.abs(a.totalCost - b.totalCost) > 1e-6) {
      return a.totalCost - b.totalCost;
    }
    return a.doses.length - b.doses.length;
  });
}

/**
 * Split a blend across the stages the authority published.
 * Returns null when the source gave no schedule -- the UI then says timing is
 * unavailable rather than inventing a split.
 */
export function splitBySchedule(blend: Blend, rec: NutrientRecommendation) {
  if (!rec.schedule || rec.schedule.length === 0) return null;
  return rec.schedule.map((stage) => ({
    stage: stage.stage,
    daysAfterSowing: stage.daysAfterSowing ?? null,
    doses: blend.doses.map((d) => ({
      product: d.product.name,
      // A product is split by the nutrient it principally carries.
      kg: d.kg * principalShare(d, stage.share),
    })).filter((x) => x.kg > 0.05),
  }));
}

function principalShare(d: ProductDose, share: Partial<Nutrients>): number {
  const { n, p2o5, k2o } = d.supplies;
  const biggest = Math.max(n, p2o5, k2o);
  if (biggest <= 0) return 0;
  if (biggest === p2o5) return share.p2o5 ?? 0;
  if (biggest === k2o) return share.k2o ?? 0;
  return share.n ?? 0;
}
