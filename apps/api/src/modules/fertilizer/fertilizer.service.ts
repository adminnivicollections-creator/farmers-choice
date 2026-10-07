import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  Blend, FertilizerProduct, NutrientRecommendation, rankBlends, requirementFor, splitBySchedule, toHectares,
} from '@fc/fert';

export type CalcInput = {
  state: string;
  district?: string;
  cropSlug: string;
  season: 'KHARIF' | 'RABI' | 'SUMMER' | 'PERENNIAL';
  irrigation: 'IRRIGATED' | 'RAINFED';
  areaValue: number;
  areaUnit: 'hectare' | 'acre' | 'gunta' | 'cent' | 'sqm';
  /** Products the farmer can actually buy. Empty = consider all active ones. */
  productKeys?: string[];
};

export type CalcResult =
  | {
      available: false;
      reason: 'no_published_recommendation';
      message: string;
      suggestions: string[];
    }
  | {
      available: true;
      crop: string;
      region: string;
      hectares: number;
      requirement: { n: number; p2o5: number; k2o: number };
      perHectare: { n: number; p2o5: number; k2o: number };
      recommendationType: string;
      blends: Blend[];
      schedule: ReturnType<typeof splitBySchedule>;
      source: NutrientRecommendation['source'];
      disclaimer: string;
    };

const DISCLAIMER =
  'Fertilizer recommendations depend on crop, soil, region and farming conditions. ' +
  'Follow the latest recommendation from the relevant agricultural authority and your ' +
  'soil-test report where available.';

@Injectable()
export class FertilizerService {
  constructor(private prisma: PrismaService) {}

  /** Crops the picker offers. Having a crop here says nothing about whether a
   *  recommendation exists for it -- calculate() decides that. */
  async crops() {
    const rows = await this.prisma.crop.findMany({ orderBy: { nameEn: 'asc' } });
    const withData = await this.prisma.nutrientRecommendation.groupBy({
      by: ['cropId'], where: { status: 'PUBLISHED' },
    });
    const has = new Set(withData.map((r) => r.cropId));
    return rows.map((c) => ({
      slug: c.slug, nameEn: c.nameEn, nameTe: c.nameTe, nameHi: c.nameHi,
      hasPublishedRecommendation: has.has(c.id),
    }));
  }

  async products() {
    const rows = await this.prisma.fertilizerProduct.findMany({
      where: { isActive: true }, orderBy: { name: 'asc' },
    });
    return rows.map(this.toProduct);
  }

  async calculate(input: CalcInput): Promise<CalcResult> {
    const crop = await this.prisma.crop.findUnique({ where: { slug: input.cropSlug } });

    // Only PUBLISHED rows are ever visible. Draft and under-review data must
    // not reach a farmer even if it exists.
    const rec = crop
      ? await this.prisma.nutrientRecommendation.findFirst({
          where: {
            cropId: crop.id,
            state: input.state,
            season: input.season as any,
            irrigation: input.irrigation as any,
            status: 'PUBLISHED',
            OR: [{ district: input.district ?? null }, { district: null }],
          },
          // A district-specific row beats a state-wide one.
          orderBy: [{ district: 'desc' }, { effectiveDate: 'desc' }],
          include: { source: true, stages: { orderBy: { orderIndex: 'asc' } } },
        })
      : null;

    if (!rec) {
      return {
        available: false,
        reason: 'no_published_recommendation',
        message:
          'Verified fertilizer recommendation unavailable for your selected crop and location.',
        suggestions: [
          'Consult your local agricultural officer',
          'Get a soil test from an accredited laboratory',
        ],
      };
    }

    const hectares = toHectares(input.areaValue, input.areaUnit);
    const recommendation: NutrientRecommendation = {
      id: rec.id,
      perHectare: {
        n: Number(rec.nPerHa), p2o5: Number(rec.p2o5PerHa), k2o: Number(rec.k2oPerHa),
      },
      type: rec.type as any,
      schedule: rec.stages.length
        ? rec.stages.map((st) => ({
            stage: st.stage,
            daysAfterSowing: st.daysAfterSowing,
            share: {
              n: st.nShare == null ? undefined : Number(st.nShare),
              p2o5: st.p2o5Share == null ? undefined : Number(st.p2o5Share),
              k2o: st.k2oShare == null ? undefined : Number(st.k2oShare),
            },
          }))
        : undefined,
      source: {
        organisation: rec.source.organisation,
        document: rec.source.document,
        url: rec.source.url,
        page: rec.source.page,
        region: rec.source.region,
        publishedOn: rec.source.publishedOn?.toISOString() ?? null,
        verifiedOn: rec.source.verifiedOn.toISOString(),
        version: rec.source.version,
      },
    };

    const where = input.productKeys?.length ? { key: { in: input.productKeys } } : {};
    const products = (
      await this.prisma.fertilizerProduct.findMany({ where: { isActive: true, ...where } })
    ).map(this.toProduct);

    const requirement = requirementFor(recommendation, hectares);
    const blends = rankBlends(requirement, products).slice(0, 3);

    return {
      available: true,
      crop: crop!.nameEn,
      region: [input.district, input.state].filter(Boolean).join(', '),
      hectares,
      requirement,
      perHectare: recommendation.perHectare,
      recommendationType: rec.type,
      blends,
      schedule: blends[0] ? splitBySchedule(blends[0], recommendation) : null,
      source: recommendation.source,
      disclaimer: DISCLAIMER,
    };
  }

  private toProduct = (r: any): FertilizerProduct => ({
    id: r.key,
    name: r.name,
    n: Number(r.nPct),
    p2o5: Number(r.p2o5Pct),
    k2o: Number(r.k2oPct),
    s: r.sPct == null ? undefined : Number(r.sPct),
    pricePerKg: null, // wired when a verified price feed exists
  });
}
