/**
 * Every area/length conversion constant in the product lives here. Nowhere else.
 * A second copy of 43560 somewhere in a component is how two screens start
 * disagreeing about how big a field is.
 */

/** Exact by definition: 1 ft = 0.3048 m. */
export const METRES_PER_FOOT = 0.3048;
export const FEET_PER_METRE = 1 / METRES_PER_FOOT; // 3.280839895…
export const SQFT_PER_SQM = FEET_PER_METRE ** 2; // 10.76391041671…

export const SQFT_PER_ACRE = 43_560;
export const SQFT_PER_CENT = SQFT_PER_ACRE / 100; // 435.6
export const SQM_PER_HECTARE = 10_000;
/** Telangana land records are kept in guntas. 1 acre = 40 guntas. */
export const GUNTAS_PER_ACRE = 40;

export const SQM_PER_ACRE = SQFT_PER_ACRE / SQFT_PER_SQM; // 4046.856…
export const SQM_PER_CENT = SQM_PER_ACRE / 100;
export const SQM_PER_GUNTA = SQM_PER_ACRE / GUNTAS_PER_ACRE;

export type AreaUnit = 'sqft' | 'sqm' | 'acre' | 'cent' | 'hectare' | 'gunta';

export const AREA_UNITS: AreaUnit[] = ['sqft', 'sqm', 'acre', 'cent', 'hectare', 'gunta'];

/** Square metres -> one unit. The single conversion path. */
export function fromSqm(areaSqm: number, unit: AreaUnit): number {
  switch (unit) {
    case 'sqm': return areaSqm;
    case 'sqft': return areaSqm * SQFT_PER_SQM;
    case 'acre': return areaSqm / SQM_PER_ACRE;
    case 'cent': return areaSqm / SQM_PER_CENT;
    case 'hectare': return areaSqm / SQM_PER_HECTARE;
    case 'gunta': return areaSqm / SQM_PER_GUNTA;
  }
}

export function toSqm(value: number, unit: AreaUnit): number {
  switch (unit) {
    case 'sqm': return value;
    case 'sqft': return value / SQFT_PER_SQM;
    case 'acre': return value * SQM_PER_ACRE;
    case 'cent': return value * SQM_PER_CENT;
    case 'hectare': return value * SQM_PER_HECTARE;
    case 'gunta': return value * SQM_PER_GUNTA;
  }
}

/**
 * Decimals that make sense for each unit. 12,540 sq.ft needs none; 0.288 acres
 * needs three, or the number reads as zero.
 */
const DECIMALS: Record<AreaUnit, number> = {
  sqft: 0, sqm: 0, acre: 3, cent: 1, hectare: 4, gunta: 2,
};

const SHORT: Record<AreaUnit, string> = {
  sqft: 'sq.ft', sqm: 'sq.m', acre: 'acres', cent: 'cents', hectare: 'ha', gunta: 'guntas',
};

export function unitLabel(unit: AreaUnit): string {
  return SHORT[unit];
}

/** "12,540 sq.ft" — grouped with Indian digit separators where available. */
export function formatArea(areaSqm: number, unit: AreaUnit, locale = 'en-IN'): string {
  const v = fromSqm(areaSqm, unit);
  const d = DECIMALS[unit];
  let num: string;
  try {
    num = v.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
  } catch {
    num = v.toFixed(d); // Hermes ships a trimmed Intl; never let formatting throw
  }
  return `${num} ${SHORT[unit]}`;
}

export function formatPerimetre(metres: number, imperial: boolean): string {
  return imperial
    ? `${Math.round(metres * FEET_PER_METRE)} ft`
    : `${Math.round(metres)} m`;
}
