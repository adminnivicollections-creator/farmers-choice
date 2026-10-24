import { fromSqm, toSqm } from '@fc/geo';

export type LandUnit = 'acre' | 'gunta' | 'cent' | 'hectare';

/**
 * Product dose x land. The farmer supplies the per-acre dose (from their soil
 * card or agriculture officer); this only multiplies and splits into bags, so
 * the app never invents an agronomic number.
 */
export function doseFor(kgPerAcre: number, land: number, unit: LandUnit, bagKg: number) {
  if (!(kgPerAcre > 0) || !(land > 0) || !(bagKg > 0)) return null;
  const acres = fromSqm(toSqm(land, unit), 'acre');
  const totalKg = Math.round(kgPerAcre * acres * 10) / 10;
  const bags = Math.floor(totalKg / bagKg);
  const looseKg = Math.round((totalKg - bags * bagKg) * 10) / 10;
  return { totalKg, bags, looseKg };
}

/** Farmers type "2,5" as often as "2.5". */
export const parseNum = (s: string) => Number(s.trim().replace(',', '.'));
