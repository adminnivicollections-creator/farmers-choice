import { fromSqm, toSqm } from '@fc/geo';

export type LandUnit = 'acre' | 'gunta' | 'cent' | 'hectare';

export const toAcres = (land: number, unit: LandUnit) => fromSqm(toSqm(land, unit), 'acre');

/** Bags to buy: always enough, never a fraction of a bag short. */
export const bagsFor = (kg: number, bagKg: number) => Math.ceil(kg / bagKg - 1e-9);

/** Farmers type "2,5" as often as "2.5". */
export const parseNum = (s: string) => Number(s.trim().replace(',', '.'));
