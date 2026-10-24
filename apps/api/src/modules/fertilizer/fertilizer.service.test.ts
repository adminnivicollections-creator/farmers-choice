/**
 * Recommendation lookup against a real Postgres: NULL ordering is the
 * database's behaviour, not ours, so only the database can check it.
 * Skipped when DATABASE_URL is not set; CI sets it.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { FertilizerService } from './fertilizer.service';

const db = process.env.DATABASE_URL ? new PrismaClient() : null;
const skip = !db && 'DATABASE_URL not set';
const tag = randomUUID().slice(0, 8);
const state = `Test State ${tag}`;

after(async () => {
  if (!db) return;
  await db.nutrientRecommendation.deleteMany({ where: { state } });
  await db.recommendationSource.deleteMany({ where: { version: tag } });
  await db.crop.deleteMany({ where: { slug: `test-${tag}` } });
  await db.$disconnect();
});

test('a district recommendation beats the state-wide one', { skip }, async () => {
  const crop = await db!.crop.create({ data: { slug: `test-${tag}`, nameEn: 'Test', nameTe: 'Test', nameHi: 'Test' } });
  const source = await db!.recommendationSource.create({
    data: { organisation: 'Test', document: 'Test', region: state, verifiedOn: new Date(), verifiedBy: 'test', version: tag },
  });
  const row = { state, cropId: crop.id, season: 'KHARIF', irrigation: 'IRRIGATED', type: 'GENERAL', status: 'PUBLISHED', sourceId: source.id, p2o5PerHa: 0, k2oPerHa: 0 } as const;
  await db!.nutrientRecommendation.create({ data: { ...row, district: null, nPerHa: 100 } });
  await db!.nutrientRecommendation.create({ data: { ...row, district: 'Guntur', nPerHa: 150 } });

  const fert = new FertilizerService(db as any);
  const ask = (district?: string) => fert.calculate({
    state, district, cropSlug: crop.slug, season: 'KHARIF', irrigation: 'IRRIGATED', areaValue: 1, areaUnit: 'hectare',
  });

  const inGuntur = await ask('Guntur');
  assert.equal(inGuntur.available && inGuntur.perHectare.n, 150);

  // No district given, or one without its own row: the state-wide row applies.
  const anywhere = await ask();
  assert.equal(anywhere.available && anywhere.perHectare.n, 100);
  const elsewhere = await ask('Krishna');
  assert.equal(elsewhere.available && elsewhere.perHectare.n, 100);
});
