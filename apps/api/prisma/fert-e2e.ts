/**
 * End-to-end check. Inserts a recommendation whose source is labelled as FAKE
 * in capital letters so it can never be mistaken for a real one, exercises the
 * calculator, then deletes it. Nothing survives this script.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const crop = await prisma.crop.findUnique({ where: { slug: 'cotton' } })
    ?? await prisma.crop.create({ data: { slug: 'cotton', nameEn: 'Cotton', nameTe: 'పత్తి', nameHi: 'कपास' } });

  const source = await prisma.recommendationSource.create({
    data: {
      organisation: 'FAKE TEST SOURCE — NOT A REAL RECOMMENDATION',
      document: 'engine smoke test',
      region: 'Test',
      verifiedOn: new Date('2026-01-01'),
      verifiedBy: 'automated test',
      version: 'test-1',
    },
  });

  const rec = await prisma.nutrientRecommendation.create({
    data: {
      state: 'Gujarat', cropId: crop.id, season: 'KHARIF', irrigation: 'IRRIGATED',
      nPerHa: 240, p2o5PerHa: 50, k2oPerHa: 50,
      type: 'GENERAL', status: 'PUBLISHED', sourceId: source.id,
      stages: { create: [
        { stage: 'Basal', orderIndex: 0, nShare: 0.25, p2o5Share: 1, k2oShare: 1 },
        { stage: 'First top dressing', daysAfterSowing: 30, orderIndex: 1, nShare: 0.375 },
        { stage: 'Second top dressing', daysAfterSowing: 60, orderIndex: 2, nShare: 0.375 },
      ] },
    },
  });

  const res = await fetch('http://localhost:3000/v1/fertilizer/calculate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'Gujarat', cropSlug: 'cotton', season: 'KHARIF',
      irrigation: 'IRRIGATED', areaValue: 2.5, areaUnit: 'acre' }),
  });
  const j: any = await res.json();

  console.log(`crop ${j.crop} · ${j.hectares.toFixed(4)} ha · ${j.recommendationType}`);
  console.log(`per ha : N ${j.perHectare.n}  P2O5 ${j.perHectare.p2o5}  K2O ${j.perHectare.k2o}`);
  console.log(`field  : N ${j.requirement.n.toFixed(1)}  P2O5 ${j.requirement.p2o5.toFixed(1)}  K2O ${j.requirement.k2o.toFixed(1)}`);
  console.log('\nbest blend:');
  for (const d of j.blends[0].doses) console.log(`  ${d.product.name.padEnd(16)} ${d.kg.toFixed(1)} kg`);
  console.log(`  excess: N ${j.blends[0].excess.n.toFixed(2)} P ${j.blends[0].excess.p2o5.toFixed(2)} K ${j.blends[0].excess.k2o.toFixed(2)}`);
  console.log('\nworkings:');
  for (const w of j.blends[0].workings) console.log(`  - ${w}`);
  console.log('\nschedule:');
  for (const st of j.schedule ?? []) {
    console.log(`  ${st.stage}${st.daysAfterSowing ? ` (day ${st.daysAfterSowing})` : ''}: ` +
      st.doses.map((d: any) => `${d.product} ${d.kg.toFixed(1)} kg`).join(', '));
  }
  console.log(`\nsource: ${j.source.organisation}`);

  await prisma.nutrientRecommendation.delete({ where: { id: rec.id } });
  await prisma.recommendationSource.delete({ where: { id: source.id } });
  const left = await prisma.nutrientRecommendation.count();
  console.log(`\ncleaned up — recommendations left in db: ${left}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
