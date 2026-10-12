import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mirrors isDevAddress in api.ts. Kept here rather than exported because the
// module pulls in react-native at import time.
function isDevAddress(url: string) {
  return /(^|\/\/)(10\.0\.2\.2|localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url);
}

test('rejects addresses that only work next to a developer', () => {
  for (const u of [
    'http://10.0.2.2:3000', 'http://localhost:3000', 'http://127.0.0.1:3000',
    'http://192.168.1.14:3000', 'http://10.1.2.3:3000', 'http://172.16.0.9:3000',
  ]) assert.equal(isDevAddress(u), true, u);
});

test('accepts real deployments', () => {
  for (const u of [
    'https://farmers-choice-api.onrender.com',
    'https://api.farmerschoice.in',
  ]) assert.equal(isDevAddress(u), false, u);
});

test('does not reject a public host that merely contains the digits', () => {
  assert.equal(isDevAddress('https://api-10.0.2.2.example.com'), false);
});
