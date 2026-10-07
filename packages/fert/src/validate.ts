import { NutrientRecommendation, RecommendationSource } from './types';

/**
 * Publication gate. A recommendation that fails any of these never reaches a
 * farmer -- the admin workflow refuses to move it past Review.
 *
 * This is the enforcement point for the product rule: no agricultural number
 * without a source.
 */
export type ValidationIssue = { field: string; problem: string };

const REQUIRED_SOURCE: (keyof RecommendationSource)[] = [
  'organisation', 'document', 'region', 'verifiedOn', 'version',
];

export function validateRecommendation(
  rec: Partial<NutrientRecommendation> & { crop?: string; season?: string; state?: string },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!rec.crop) issues.push({ field: 'crop', problem: 'Crop is required' });
  if (!rec.state) issues.push({ field: 'state', problem: 'State is required' });
  if (!rec.season) issues.push({ field: 'season', problem: 'Season is required' });

  const n = rec.perHectare;
  if (!n) {
    issues.push({ field: 'perHectare', problem: 'Nutrient requirement is required' });
  } else {
    for (const key of ['n', 'p2o5', 'k2o'] as const) {
      const v = n[key];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        issues.push({ field: `perHectare.${key}`, problem: 'Must be a number' });
      } else if (v < 0) {
        issues.push({ field: `perHectare.${key}`, problem: 'Cannot be negative' });
      } else if (v > 1000) {
        // Not an agronomic judgement, a typo guard: no published Indian
        // recommendation reaches 1000 kg/ha of a single nutrient.
        issues.push({ field: `perHectare.${key}`, problem: 'Implausibly large — check the units' });
      }
    }
  }

  if (!rec.type) issues.push({ field: 'type', problem: 'Recommendation type is required' });

  if (!rec.source) {
    issues.push({ field: 'source', problem: 'A source is required. No agricultural number without a source.' });
  } else {
    for (const f of REQUIRED_SOURCE) {
      if (!rec.source[f]) issues.push({ field: `source.${f}`, problem: `${f} is required` });
    }
    if (rec.source.verifiedOn && Number.isNaN(Date.parse(rec.source.verifiedOn))) {
      issues.push({ field: 'source.verifiedOn', problem: 'Must be a date' });
    }
  }

  for (const stage of rec.schedule ?? []) {
    if (!stage.stage) issues.push({ field: 'schedule.stage', problem: 'Stage name is required' });
    for (const key of ['n', 'p2o5', 'k2o'] as const) {
      const v = stage.share?.[key];
      if (v != null && (v < 0 || v > 1)) {
        issues.push({ field: `schedule.share.${key}`, problem: 'Share must be between 0 and 1' });
      }
    }
  }

  // Stage shares must account for the whole dose, or part of it silently vanishes.
  if (rec.schedule?.length) {
    for (const key of ['n', 'p2o5', 'k2o'] as const) {
      const sum = rec.schedule.reduce((t, s) => t + (s.share?.[key] ?? 0), 0);
      if (sum > 0 && Math.abs(sum - 1) > 0.01) {
        issues.push({ field: `schedule.share.${key}`, problem: `Shares add up to ${sum.toFixed(2)}, not 1` });
      }
    }
  }

  return issues;
}

export const isPublishable = (rec: Parameters<typeof validateRecommendation>[0]) =>
  validateRecommendation(rec).length === 0;
