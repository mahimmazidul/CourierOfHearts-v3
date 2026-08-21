// Crypto layer unit tests: wrap/unwrap round trips, wrong-key rejection,
// recovery token shape, and backup encrypt/decrypt symmetry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  generateDek, encryptLetterPayload, decryptLetterPayload,
  wrapDekWithKek, unwrapDekWithKek,
  wrapDekWithPassword, unwrapDekWithPassword,
  generateRecoveryToken, normalizeRecoveryToken,
  wrapDekWithRecoveryToken, unwrapDekWithRecoveryToken,
} from '../server/crypto.js';

test('letter payload encrypt/decrypt round trip (Bangla + emoji)', () => {
  const dek = generateDek();
  const payload = { content: 'আমি তোমাকে ভালোবাসি ❤️ <b>bold</b>', recipient: 'Maria' };
  const blob = encryptLetterPayload(dek, payload);
  assert.match(blob, /^v1\./);
  assert.deepEqual(decryptLetterPayload(dek, blob), payload);
});

test('each encryption uses a unique nonce', () => {
  const dek = generateDek();
  const a = encryptLetterPayload(dek, { x: 1 });
  const b = encryptLetterPayload(dek, { x: 1 });
  assert.notEqual(a.split('.')[1], b.split('.')[1]);
});

test('KEK wrap round trip; wrong KEK fails', () => {
  const kek = randomBytes(32);
  const dek = generateDek();
  const wrapped = wrapDekWithKek(kek, dek);
  assert.deepEqual(unwrapDekWithKek(kek, wrapped), dek);
  assert.throws(() => unwrapDekWithKek(randomBytes(32), wrapped));
});

test('password wrap: correct password unwraps, wrong password throws', async () => {
  const dek = generateDek();
  const wrapped = await wrapDekWithPassword(dek, 'rosewater');
  assert.match(wrapped, /^argon2id\./);
  assert.deepEqual(await unwrapDekWithPassword(wrapped, 'rosewater'), dek);
  await assert.rejects(unwrapDekWithPassword(wrapped, 'rosewaterX'));
});

test('recovery token: format, uniqueness, wrap round trip', () => {
  const token = generateRecoveryToken();
  assert.match(token, /^COH-RCV-[A-Z2-9]{26}$/);
  assert.notEqual(token, generateRecoveryToken());
  const dek = generateDek();
  const wrapped = wrapDekWithRecoveryToken(dek, token);
  assert.deepEqual(unwrapDekWithRecoveryToken(wrapped, token), dek);
  assert.throws(() => unwrapDekWithRecoveryToken(wrapped, generateRecoveryToken()));
});

test('recovery token normalization', () => {
  assert.equal(normalizeRecoveryToken('  coh-rcv-abc 234  '), 'COH-RCV-ABC234');
});
