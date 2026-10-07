#!/usr/bin/env node
/**
 * Word error rate for the Telugu STT pilot. See tools/stt-pilot.md.
 * Usage: node tools/stt-pilot.mjs <dir-with-.txt-reference-and-.hyp-files>
 *
 * Deliberately does not call a speech API: generate the .hyp files with
 * whichever provider you are evaluating, then run this to score them.
 * That way the scorer stays provider-agnostic and needs no credentials.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const norm = (s) =>
  s.replace(/[।॥.,!?;:"'()\[\]]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

/** Levenshtein over words. */
export function wer(refText, hypText) {
  const r = norm(refText), h = norm(hypText);
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 0; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++)
    for (let j = 1; j <= h.length; j++)
      d[i][j] = r[i - 1] === h[j - 1]
        ? d[i - 1][j - 1]
        : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
  return d[r.length][h.length] / r.length;
}

function main(dir) {
  const ids = [...new Set(readdirSync(dir).filter((f) => ['.txt', '.hyp'].includes(extname(f)))
    .map((f) => basename(f, extname(f))))];
  if (!ids.length) { console.error(`no .txt/.hyp pairs in ${dir}`); process.exit(1); }

  let total = 0, n = 0;
  for (const id of ids) {
    try {
      const score = wer(readFileSync(join(dir, `${id}.txt`), 'utf8'), readFileSync(join(dir, `${id}.hyp`), 'utf8'));
      console.log(`${id.padEnd(24)} WER ${(score * 100).toFixed(1)}%`);
      total += score; n++;
    } catch { console.log(`${id.padEnd(24)} SKIP (missing pair)`); }
  }
  const mean = total / n;
  console.log(`\n${n} samples · mean WER ${(mean * 100).toFixed(1)}%`);
  console.log(mean < 0.15 ? '=> ship transcripts as designed'
    : mean < 0.30 ? '=> ship, but always editable and never auto-posted'
    : '=> drop transcripts, ship voice-only posts');
}

if (process.argv[2]) main(process.argv[2]);
