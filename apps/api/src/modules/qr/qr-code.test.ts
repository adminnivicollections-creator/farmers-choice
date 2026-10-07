import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_RAW_LENGTH, outcomeFor, parseScanned, suspicion } from './qr-code';

test('parses our own codes', () => {
  assert.deepEqual(parseScanned('FC1:abcdefghijklmnop'), { kind: 'fc', code: 'abcdefghijklmnop' });
  assert.deepEqual(parseScanned('  FC1:abcdefghijklmnop  '), { kind: 'fc', code: 'abcdefghijklmnop' });
});

test('a malformed body is not treated as one of ours', () => {
  assert.deepEqual(parseScanned('FC1:short'), { kind: 'rejected', reason: 'malformed' });
  assert.deepEqual(parseScanned('FC1:has spaces in it here'), { kind: 'rejected', reason: 'malformed' });
  assert.deepEqual(parseScanned('FC1:<script>alert(1)</script>'), { kind: 'rejected', reason: 'malformed' });
});

test('someone else’s QR is foreign, never followed', () => {
  for (const raw of ['https://evil.example/pay', 'upi://pay?pa=x@y&am=5000', 'just some text']) {
    assert.deepEqual(parseScanned(raw), { kind: 'foreign', raw }, raw);
  }
});

test('empty and oversized input is rejected outright', () => {
  assert.deepEqual(parseScanned(''), { kind: 'rejected', reason: 'empty' });
  assert.deepEqual(parseScanned(null), { kind: 'rejected', reason: 'empty' });
  assert.deepEqual(parseScanned(undefined), { kind: 'rejected', reason: 'empty' });
  assert.deepEqual(parseScanned('x'.repeat(MAX_RAW_LENGTH + 1)), { kind: 'rejected', reason: 'too_long' });
});

const tag = (over = {}) => ({
  type: 'PRODUCT_BATCH' as const, payload: {}, expiresAt: null, revokedAt: null, ...over,
});

test('outcome covers genuine, unknown, revoked and expired', () => {
  assert.equal(outcomeFor(tag()), 'genuine');
  assert.equal(outcomeFor(null), 'unknown');
  assert.equal(outcomeFor(tag({ revokedAt: new Date() })), 'revoked');
  assert.equal(outcomeFor(tag({ expiresAt: new Date(Date.now() - 1) })), 'expired');
  assert.equal(outcomeFor(tag({ expiresAt: new Date(Date.now() + 60_000) })), 'genuine');
});

test('revoked beats expired — a recalled batch is not merely stale', () => {
  assert.equal(outcomeFor(tag({ revokedAt: new Date(), expiresAt: new Date(Date.now() - 1) })), 'revoked');
});

test('one batch across many districts is flagged', () => {
  assert.deepEqual(suspicion({ districtCount: 3, scanCount: 4, firstScanAt: new Date() }),
    { suspicious: true, reason: 'scanned_in_many_districts' });
});

test('an implausible number of scans is flagged', () => {
  assert.deepEqual(suspicion({ districtCount: 1, scanCount: 25, firstScanAt: new Date() }),
    { suspicious: true, reason: 'scanned_unusually_often' });
});

test('normal use is not flagged', () => {
  assert.deepEqual(suspicion({ districtCount: 1, scanCount: 3, firstScanAt: new Date() }),
    { suspicious: false });
  assert.deepEqual(suspicion({ districtCount: 0, scanCount: 0, firstScanAt: null }), { suspicious: false });
});
