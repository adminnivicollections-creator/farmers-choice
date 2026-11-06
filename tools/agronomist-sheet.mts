/**
 * docs/agronomist-review.md from the app's own data, so the reviewer checks
 * exactly what farmers see.  Run: npx tsx tools/agronomist-sheet.mts
 */
import { writeFileSync } from 'node:fs';
import { RECS, productsPerAcre, type Split } from '../apps/mobile/src/features/fertilizer/recommendations.ts';

const kg = ([a, b]: [number, number], x = 1) =>
  Math.round(a * x) === Math.round(b * x) ? `${Math.round(a * x)}` : `${Math.round(a * x)}–${Math.round(b * x)}`;
const when = (s: Split) => ('days' in s ? `${s.days} days after ${s.after}` : s.at === 'basal' ? 'at sowing/planting' : 'at flowering');
const name = { dap: 'DAP', ssp: 'SSP', urea: 'Urea', mop: 'MOP', gypsum: 'Gypsum' };

const rows = RECS.map((r, i) => {
  const ds = productsPerAcre(r);
  const nut = `${r.n.join('–')} N : ${r.p2o5.join('–')} P₂O₅ : ${r.k2o.join('–')} K₂O kg/${r.per}`.replace(/(\d+)–\1/g, '$1');
  const bags = ds.map((d) => `${name[d.key]} ${kg(d.perAcre)} kg`).join(', ');
  const timing = ds.map((d) => `${name[d.key]}: ${d.timing ? d.timing.map((s) => `${Math.round(s.share * 100)}% ${when(s)}`).join(', ') : '—'}`).join('<br>');
  return `| ${i + 1} | **${r.crop}**${r.variant ? ` (${r.variant})` : ''} | ${nut}${r.gypsum ? ` + gypsum ${r.gypsum} kg/${r.per}` : ''} | ${bags} | ${timing} | ${r.source} | ☐ OK ☐ Change |`;
});

writeFileSync(new URL('../docs/agronomist-review.md', import.meta.url), `# Fertilizer figures — agronomist review

Farmer's Choice shows these doses to farmers in Andhra Pradesh. Each row was
copied from the document named in "Source". Please check each against the
source page (or the current ANGRAU Vyavasaya Panchangam) and tick **OK** or
write the correct figure under **Change**.

The app converts nutrients to bags as: DAP 18-46-0 (its nitrogen is
subtracted before urea), SSP 16% P₂O₅, urea 46% N, MOP 60% K₂O. "Per acre"
below is after that conversion. "—" in timing means the source gives none and
the app tells the farmer to ask the agriculture officer.

| # | Crop | As printed in source | App's per-acre bags | Timing shown | Source | Check |
|---|---|---|---|---|---|---|
${rows.join('\n')}

**Not in the app (please advise if you have official figures):** chilli,
paddy in the Scarce Rainfall zone (source prints N 240 kg/ha), Bengal gram
(ANGRAU and ICAR figures disagree), cotton outside Coastal AP hybrids.

Reviewed by: ______________________  Designation: ______________________

Date: ______________  Signature: ______________________
`);
console.log(`wrote docs/agronomist-review.md (${rows.length} rows)`);
