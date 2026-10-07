import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OTP_MAX_ATTEMPTS,
  checkOtp,
  codeMatches,
  generateCode,
  hashCode,
  newSalt,
  normalisePhone,
  type OtpRow,
} from './otp';

test('normalisePhone accepts the formats farmers actually type', () => {
  for (const input of ['9876543210', '09876543210', '+91 98765 43210', '91-9876543210', '  +919876543210 ']) {
    assert.equal(normalisePhone(input), '+919876543210', `failed for ${input}`);
  }
});

test('normalisePhone rejects non-mobile and malformed input', () => {
  for (const bad of ['1234567890', '5876543210', '98765', '', '98765432101234', 'abcdefghij']) {
    assert.equal(normalisePhone(bad), null, `should reject ${bad}`);
  }
});

test('generateCode is always 6 digits', () => {
  for (let i = 0; i < 500; i++) assert.match(generateCode(), /^\d{6}$/);
});

test('codeMatches is true only for the right code', () => {
  const salt = newSalt();
  const hash = hashCode('123456', salt);
  assert.equal(codeMatches('123456', salt, hash), true);
  assert.equal(codeMatches('123457', salt, hash), false);
  assert.equal(codeMatches('123456', newSalt(), hash), false);
});

const valid = (over: Partial<OtpRow> = {}): OtpRow => {
  const salt = newSalt();
  return {
    salt,
    codeHash: hashCode('123456', salt),
    attempts: 0,
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...over,
  };
};

test('checkOtp accepts a fresh correct code', () => {
  assert.deepEqual(checkOtp(valid(), '123456'), { ok: true });
});

test('checkOtp rejects wrong, expired, consumed and exhausted codes', () => {
  assert.deepEqual(checkOtp(valid(), '000000'), { ok: false, reason: 'wrong_code' });
  assert.deepEqual(checkOtp(null, '123456'), { ok: false, reason: 'expired' });
  assert.deepEqual(
    checkOtp(valid({ expiresAt: new Date(Date.now() - 1) }), '123456'),
    { ok: false, reason: 'expired' },
  );
  assert.deepEqual(
    checkOtp(valid({ consumedAt: new Date() }), '123456'),
    { ok: false, reason: 'consumed' },
  );
  assert.deepEqual(
    checkOtp(valid({ attempts: OTP_MAX_ATTEMPTS }), '123456'),
    { ok: false, reason: 'too_many_attempts' },
  );
});

test('an exhausted code is rejected even when the code is correct', () => {
  const row = valid({ attempts: OTP_MAX_ATTEMPTS });
  assert.equal(checkOtp(row, '123456').ok, false);
});
