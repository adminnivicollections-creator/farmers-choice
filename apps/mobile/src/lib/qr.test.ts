import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeScan } from './qr';

test('an ordinary website opens on its own', () => {
  const s = describeScan('https://www.iffco.in/en/products?id=12');
  assert.equal(s.kind, 'url');
  assert.equal(s.host, 'www.iffco.in');
  assert.equal(s.autoOpen, true);
  assert.equal(s.href, 'https://www.iffco.in/en/products?id=12');
});

test('a long link opens in full, not cut to the display length', () => {
  const long = `https://example.com/${'a'.repeat(300)}`;
  const s = describeScan(long);
  assert.equal(s.href, long);
  assert.ok(s.display.length <= 200);
});

test('a lookalike address is never opened automatically', () => {
  const s = describeScan('https://xn--pypal-4ve.com/login');
  assert.equal(s.suspiciousHost, true);
  assert.equal(s.autoOpen, false);
});

test('payments, phone numbers and places wait for a tap', () => {
  const upi = describeScan('upi://pay?pa=ramesh@okaxis&pn=Ramesh%20Traders&am=500');
  assert.deepEqual([upi.kind, upi.autoOpen, upi.payee, upi.payeeName, upi.amount],
    ['upi', false, 'ramesh@okaxis', 'Ramesh Traders', '500']);
  assert.equal(describeScan('tel:+919876543210').autoOpen, false);
  assert.equal(describeScan('geo:16.31,80.44').autoOpen, false);
});

test('plain text and Wi-Fi are shown, with nothing to open', () => {
  const t = describeScan('BATCH-2026-X99');
  assert.deepEqual([t.kind, t.href, t.autoOpen], ['text', undefined, false]);
  assert.equal(describeScan('WIFI:S:farm;T:WPA;P:secret;;').href, undefined);
});

test('hidden direction-override characters are stripped from what is shown', () => {
  assert.equal(describeScan('abc‮def').display, 'abcdef');
});
