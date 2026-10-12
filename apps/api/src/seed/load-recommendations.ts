/**
 * Writes sourced recommendations. Validates first, so a bad row fails the
 * seed rather than reaching a farmer.
 *
 * ponytail: ids are derived from the natural key by hash rather than adding a
 * unique constraint and a migration. ~25 rows revised once a year does not
 * need either. If this ever grows an admin write path, put a real @@unique on
 * (state, district, cropId, variety, season, irrigation, soilCondition, type,
 * sourceId) and upsert on that instead.
 */
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { RECOMMENDATIONS, SOURCES, RecSeed, SourceSeed, validate } from './recommendations';

/** Stable uuid from a natural key, so re-seeding updates instead of duplicating. */
function stableId(parts: Array<string | undefined>): string {
  const h = createHash('sha256').update(parts.map((p) => p ?? '').join('\u0000')).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), `5${h.slice(13, 16)}`, `8${h.slice(17, 20)}`, h.slice(20, 32)].join('-');
}

const sourceId = (s: SourceSeed) => stableId(['source', s.key]);
const recordId = (r: RecSeed) =>
  stableId([r.state, r.district, r.cropSlug, r.variety, r.season, r.irrigation, r.soilCondition, r.type, r.sourceKey]);

export async function loadRecommendations(
  prisma: PrismaClient,
  sources: SourceSeed[] = SOURCES,
  rows: RecSeed[] = RECOMMENDATIONS,
) {
  const problems = validate(sources, rows);
  if (problems.length) {
    for (const p of problems) console.error(`  ${p.row}: ${p.problem}`);
    throw new Error(`${problems.length} invalid recommendation row(s) -- refusing to seed`);
  }

  if (!rows.length) {
    console.log('recommendations: none defined yet (see src/seed/recommendations.ts)');
    return { sources: 0, rows: 0, published: 0 };
  }

  for (const s of sources) {
    const data = {
      organisation: s.organisation,
      document: s.document,
      version: s.version,
      region: s.region,
      url: s.url ?? null,
      publishedOn: s.publishedOn ? new Date(s.publishedOn) : null,
      // verifiedOn is required by the schema; an unreviewed source records the
      // epoch so it is obvious in the data that nobody has signed it off.
      verifiedOn: s.verifiedOn ? new Date(s.verifiedOn) : new Date(0),
      verifiedBy: s.verifiedBy ?? 'UNVERIFIED',
    };
    await prisma.recommendationSource.upsert({
      where: { id: sourceId(s) },
      update: data,
      create: { id: sourceId(s), ...data },
    });
  }

  let published = 0;
  for (const r of rows) {
    const crop = await prisma.crop.findUnique({ where: { slug: r.cropSlug } });
    if (!crop) throw new Error(`unknown cropSlug '${r.cropSlug}' -- seed crops first`);

    const id = recordId(r);
    const data = {
      state: r.state,
      district: r.district ?? null,
      agroClimaticZone: r.agroClimaticZone ?? null,
      cropId: crop.id,
      variety: r.variety ?? null,
      season: r.season as any,
      irrigation: r.irrigation as any,
      soilCondition: r.soilCondition ?? null,
      targetYieldQtlHa: r.targetYieldQtlHa ?? null,
      nPerHa: r.nPerHa,
      p2o5PerHa: r.p2o5PerHa,
      k2oPerHa: r.k2oPerHa,
      type: r.type as any,
      status: r.status as any,
      effectiveDate: r.effectiveDate ? new Date(r.effectiveDate) : null,
      sourceId: sourceId(sources.find((s) => s.key === r.sourceKey)!),
      sourcePage: r.page ?? null,
    };

    await prisma.nutrientRecommendation.upsert({ where: { id }, update: data, create: { id, ...data } });
    if (r.status === 'PUBLISHED') published++;

    // Stages are replaced wholesale: editing a split in the file should not
    // leave the old stages behind alongside the new ones.
    await prisma.applicationStageRow.deleteMany({ where: { recommendationId: id } });
    if (r.stages?.length) {
      await prisma.applicationStageRow.createMany({
        data: r.stages.map((s, i) => ({
          recommendationId: id,
          stage: s.stage,
          daysAfterSowing: s.daysAfterSowing ?? null,
          orderIndex: i,
          nShare: s.nShare ?? null,
          p2o5Share: s.p2o5Share ?? null,
          k2oShare: s.k2oShare ?? null,
        })),
      });
    }
  }

  console.log(`recommendations: ${sources.length} source(s), ${rows.length} row(s), ${published} published`);
  return { sources: sources.length, rows: rows.length, published };
}
