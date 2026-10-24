/**
 * Sourced fertilizer recommendations.
 *
 * Every row here must trace to a published document. The schema enforces it
 * (sourceId is required, RecommendationSource demands organisation, document,
 * version, verifiedBy and verifiedOn) and validate() below enforces the rest
 * before anything reaches the database.
 *
 * This file is deliberately empty of real figures. Do not add a number from
 * memory, a website summary, or an LLM -- read it off the document, record the
 * page, and have someone qualified check it. A wrong number here costs a
 * farmer a season.
 *
 * Workflow: add rows as DRAFT -> reviewer checks against the document ->
 * set verifiedBy/verifiedOn on the source and status to PUBLISHED. Only
 * PUBLISHED rows are ever served.
 */

export type Season = 'KHARIF' | 'RABI' | 'SUMMER' | 'PERENNIAL';
export type Irrigation = 'IRRIGATED' | 'RAINFED';
export type RecType = 'GENERAL' | 'SOIL_TEST' | 'STCR';
export type RecStatus = 'DRAFT' | 'REVIEW' | 'VERIFIED' | 'PUBLISHED' | 'RETIRED';

export type SourceSeed = {
  /** Stable short key used by rows below. Never served. */
  key: string;
  organisation: string;
  document: string;
  version: string;
  region: string;
  url?: string;
  publishedOn?: string;
  /** Who checked these rows against the document. Required to publish. */
  verifiedBy?: string;
  verifiedOn?: string;
};

export type StageSeed = {
  stage: string;
  daysAfterSowing?: number;
  /** Share of each nutrient applied at this stage, 0-1. Null = not applied. */
  nShare?: number;
  p2o5Share?: number;
  k2oShare?: number;
};

export type RecSeed = {
  sourceKey: string;
  cropSlug: string;
  state: string;
  /** Null means the row applies state-wide. A district row wins over it. */
  district?: string;
  agroClimaticZone?: string;
  variety?: string;
  season: Season;
  irrigation: Irrigation;
  soilCondition?: string;
  /** kg per hectare, as published. P and K on oxide basis. */
  nPerHa: number;
  p2o5PerHa: number;
  k2oPerHa: number;
  targetYieldQtlHa?: number;
  type: RecType;
  status: RecStatus;
  effectiveDate?: string;
  /** Page or table in the source document. Required to publish. */
  page?: string;
  stages?: StageSeed[];
};

export const SOURCES: SourceSeed[] = [
  // {
  //   key: 'angrau-pop-2026',
  //   organisation: 'ANGRAU',
  //   document: 'Package of Practices',
  //   version: '2026',
  //   region: 'Andhra Pradesh',
  //   url: 'https://angrau.ac.in/...',
  //   publishedOn: '2026-04-01',
  //   verifiedBy: 'name, designation',   // set when a reviewer signs off
  //   verifiedOn: '2026-10-12',
  // },
];

export const RECOMMENDATIONS: RecSeed[] = [
  // {
  //   sourceKey: 'angrau-pop-2026',
  //   cropSlug: 'paddy',
  //   state: 'Andhra Pradesh',
  //   district: 'Guntur',
  //   season: 'KHARIF',
  //   irrigation: 'IRRIGATED',
  //   nPerHa: 0, p2o5PerHa: 0, k2oPerHa: 0,   // <- off the document, with page
  //   type: 'GENERAL',
  //   status: 'DRAFT',
  //   page: 'Table 3.2, p.41',
  //   stages: [
  //     { stage: 'basal',     nShare: 0.5, p2o5Share: 1, k2oShare: 0.5 },
  //     { stage: 'tillering', daysAfterSowing: 25, nShare: 0.25 },
  //     { stage: 'panicle',   daysAfterSowing: 50, nShare: 0.25, k2oShare: 0.5 },
  //   ],
  // },
];

/** Nothing above this is plausible as kg/ha for a field crop. */
const MAX_KG_PER_HA = 500;
const SHARE_TOLERANCE = 0.001;

export type Problem = { row: string; problem: string };

/**
 * Rejects data that must never reach a farmer. Runs before any write, so a
 * bad row fails the seed instead of being served.
 */
export function validate(sources: SourceSeed[], rows: RecSeed[]): Problem[] {
  const problems: Problem[] = [];
  const byKey = new Map(sources.map((s) => [s.key, s]));

  for (const s of sources) {
    if (!s.organisation?.trim() || !s.document?.trim() || !s.version?.trim()) {
      problems.push({ row: s.key, problem: 'source needs organisation, document and version' });
    }
  }

  rows.forEach((r, i) => {
    const id = `${r.cropSlug}/${r.season}/${r.irrigation}${r.district ? `/${r.district}` : ''} [${i}]`;
    const src = byKey.get(r.sourceKey);

    if (!src) {
      problems.push({ row: id, problem: `unknown sourceKey '${r.sourceKey}'` });
    }

    for (const [name, v] of [['nPerHa', r.nPerHa], ['p2o5PerHa', r.p2o5PerHa], ['k2oPerHa', r.k2oPerHa]] as const) {
      if (!Number.isFinite(v) || v < 0) problems.push({ row: id, problem: `${name} must be >= 0` });
      else if (v > MAX_KG_PER_HA) problems.push({ row: id, problem: `${name} of ${v} kg/ha is implausible` });
    }

    // Publishing is the gate: a served number needs a named reviewer and a page.
    if (r.status === 'PUBLISHED') {
      if (!src?.verifiedBy?.trim() || !src?.verifiedOn?.trim()) {
        problems.push({ row: id, problem: 'cannot publish: source has no verifiedBy/verifiedOn' });
      }
      if (!r.page?.trim()) {
        problems.push({ row: id, problem: 'cannot publish: no page reference in the source document' });
      }
      if (r.nPerHa === 0 && r.p2o5PerHa === 0 && r.k2oPerHa === 0) {
        problems.push({ row: id, problem: 'cannot publish all-zero nutrients -- looks like a placeholder' });
      }
    }

    // A split schedule that does not add up would silently under- or over-apply.
    if (r.stages?.length) {
      const perHa = { nShare: r.nPerHa, p2o5Share: r.p2o5PerHa, k2oShare: r.k2oPerHa };
      for (const n of ['nShare', 'p2o5Share', 'k2oShare'] as const) {
        const parts = r.stages.map((s) => s[n]).filter((v): v is number => v != null);
        if (!parts.length) {
          // A required nutrient with no stage would vanish from the timing
          // table, and so would the product that carries it.
          if (perHa[n] > 0) problems.push({ row: id, problem: `${n} is required but no stage applies it` });
          continue;
        }
        if (parts.some((v) => v < 0 || v > 1)) {
          problems.push({ row: id, problem: `${n} values must each be 0-1` });
          continue;
        }
        const total = parts.reduce((a, b) => a + b, 0);
        if (Math.abs(total - 1) > SHARE_TOLERANCE) {
          problems.push({ row: id, problem: `${n} shares sum to ${total.toFixed(3)}, expected 1.000` });
        }
      }
    }
  });

  return problems;
}
