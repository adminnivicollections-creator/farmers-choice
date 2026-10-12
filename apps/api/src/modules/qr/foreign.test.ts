import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeForeign } from './qr-code';

test('plain website is openable and names its host', () => {
  const d = describeForeign('https://www.iffco.in/products');
  assert.equal(d.kind, 'url');
  assert.equal(d.openable, true);
  assert.equal(d.host, 'www.iffco.in');
  assert.equal(d.suspiciousHost, false);
});

test('a punycode lookalike domain is flagged', () => {
  const d = describeForeign('https://xn--pypal-4ve.com/login');
  assert.equal(d.suspiciousHost, true, 'impostor host must be flagged');
  assert.ok(d.host?.includes('xn--'), 'shows the host that actually resolves');
});

test('non-http schemes are never openable', () => {
  for (const raw of [
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'file:///etc/passwd',
    'intent://scan#Intent;scheme=x;end',
  ]) assert.equal(describeForeign(raw).openable, false, raw);
});

test('UPI payment shows the payee and is never openable', () => {
  const d = describeForeign('upi://pay?pa=scam@ybl&pn=Fake%20Seeds&am=2500');
  assert.equal(d.kind, 'upi');
  assert.equal(d.openable, false);
  assert.equal(d.payee, 'scam@ybl');
  assert.equal(d.payeeName, 'Fake Seeds');
  assert.equal(d.amount, '2500');
});

test('phone, email, wifi and geo are recognised, none openable', () => {
  assert.equal(describeForeign('tel:+919876543210').kind, 'phone');
  assert.equal(describeForeign('mailto:a@b.com').kind, 'email');
  assert.equal(describeForeign('WIFI:S:shop;T:WPA;P:secret;;').kind, 'wifi');
  assert.equal(describeForeign('geo:16.3,80.4').kind, 'geo');
  for (const r of ['tel:+91', 'mailto:a@b.com', 'WIFI:S:x;;', 'geo:1,2'])
    assert.equal(describeForeign(r).openable, false, r);
});

test('control characters and bidi overrides are stripped', () => {
  const d = describeForeign('https://good.com‮moc.dab//:sptth');
  assert.ok(!d.display.includes('‮'), 'bidi override must not survive');
});

test('very long input is capped', () => {
  assert.ok(describeForeign('x'.repeat(5000)).display.length <= 200);
});

test('unparseable text falls back to text, not url', () => {
  assert.equal(describeForeign('https://').kind, 'text');
  assert.equal(describeForeign('just some words').kind, 'text');
});
