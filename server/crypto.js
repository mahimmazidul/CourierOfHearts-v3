// Crypto layer — every letter body is encrypted at rest with its own random
// data-encryption key (DEK).
//
//   Unprotected letter:  DEK wrapped with the server KEK (AES-256-GCM).
//   Protected letter:    DEK wrapped twice:
//       1. with a key derived from the user's password via Argon2id
//       2. with a key derived from a random per-letter recovery token
//     No KEK wrap exists for protected letters, so the server alone cannot
//     read them: either the password or the recovery token is required.
//
// The recovery token itself is NEVER stored — only the wrap it produced.
// Crypto metadata is versioned inside each serialized blob ("v1.").
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import argon2 from 'argon2';

const VERSION = 'v1';
// Argon2id parameters: 64 MiB / 3 iterations / parallelism 1. Chosen to be
// meaningfully slow for online brute force while fine for a small VPS.
const ARGON2_OPTS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1, hashLength: 32 };

const b64 = (buf) => buf.toString('base64url');
const unb64 = (s) => Buffer.from(s, 'base64url');

function aesGcmEncrypt(key, plaintext) {
  const iv = randomBytes(12); // GCM: unique 96-bit nonce per encryption
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return `${VERSION}.${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(data)}`;
}

function aesGcmDecrypt(key, blob) {
  const [version, ivB, tagB, dataB] = String(blob).split('.');
  if (version !== VERSION) throw new Error(`Unsupported crypto blob version: ${version}`);
  const decipher = createDecipheriv('aes-256-gcm', key, unb64(ivB));
  decipher.setAuthTag(unb64(tagB));
  return Buffer.concat([decipher.update(unb64(dataB)), decipher.final()]);
}

export function generateDek() {
  return randomBytes(32);
}

export function encryptLetterPayload(dek, payloadObject) {
  return aesGcmEncrypt(dek, Buffer.from(JSON.stringify(payloadObject), 'utf8'));
}

export function decryptLetterPayload(dek, blob) {
  return JSON.parse(aesGcmDecrypt(dek, blob).toString('utf8'));
}

export function wrapDekWithKek(kek, dek) {
  return aesGcmEncrypt(kek, dek);
}

export function unwrapDekWithKek(kek, blob) {
  return aesGcmDecrypt(kek, blob);
}

// ---- Password wrapping (Argon2id) ----------------------------------------

export async function wrapDekWithPassword(dek, password) {
  const salt = randomBytes(16);
  const key = await argon2.hash(password, { ...ARGON2_OPTS, salt, raw: true });
  const wrapped = aesGcmEncrypt(key, dek);
  key.fill(0);
  // Store the KDF parameters alongside so they can evolve later.
  return `argon2id.m65536t3p1.${b64(salt)}.${wrapped}`;
}

export async function unwrapDekWithPassword(blob, password) {
  const [kdf, params, saltB, ...rest] = String(blob).split('.');
  if (kdf !== 'argon2id' || params !== 'm65536t3p1') throw new Error('Unsupported password wrap format');
  const key = await argon2.hash(password, { ...ARGON2_OPTS, salt: unb64(saltB), raw: true });
  try {
    return aesGcmDecrypt(key, rest.join('.')); // throws on wrong password (GCM auth failure)
  } finally {
    key.fill(0);
  }
}

// ---- Recovery token wrapping ----------------------------------------------

// 26 chars over a 32-symbol unambiguous alphabet = 130 bits of entropy.
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

export function generateRecoveryToken() {
  const bytes = randomBytes(26);
  let out = '';
  for (const byte of bytes) out += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
  return `COH-RCV-${out}`;
}

export function normalizeRecoveryToken(input) {
  return String(input || '').trim().toUpperCase().replace(/\s+/g, '');
}

// The recovery token already carries ~130 bits of entropy, so HKDF-SHA256 is
// an appropriate (and fast) KDF here — a memory-hard KDF is only needed for
// low-entropy human passwords.
function recoveryKey(token, salt) {
  return Buffer.from(hkdfSync('sha256', Buffer.from(token, 'utf8'), salt, 'coh-recovery-wrap-v1', 32));
}

export function wrapDekWithRecoveryToken(dek, token) {
  const salt = randomBytes(16);
  const key = recoveryKey(token, salt);
  const wrapped = aesGcmEncrypt(key, dek);
  key.fill(0);
  return `hkdf-rcv.${b64(salt)}.${wrapped}`;
}

export function unwrapDekWithRecoveryToken(blob, token) {
  const [scheme, saltB, ...rest] = String(blob).split('.');
  if (scheme !== 'hkdf-rcv') throw new Error('Unsupported recovery wrap format');
  const key = recoveryKey(token, unb64(saltB));
  try {
    return aesGcmDecrypt(key, rest.join('.'));
  } finally {
    key.fill(0);
  }
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
