// Request validation. Strict allowlists, bounded sizes, no surprises.
import { config } from './config.js';

export const SEAL_TYPES = new Set(['rose', 'heart', 'crown', 'raven', 'initials', 'monogram']);
export const SEAL_COLORS = new Set(['burgundy', 'crimson', 'emerald', 'gold', 'black']);
export const CRESTS = new Set(['none', 'royal', 'floral', 'shield', 'wreath', 'wings']);
export const BODY_FONTS = new Set([
  'eb-garamond', 'cormorant', 'crimson', 'medieval', 'uncial', 'almendra',
  'marck', 'parisienne', 'noto-serif-bengali', 'hind-siliguri',
]);
export const SIGNATURE_FONTS = new Set(['great-vibes', 'satisfy', 'dancing', 'marck', 'parisienne']);

export const SLUG_RE = /^[A-Za-z0-9_-]{4,64}$/;

export function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

function validateFlower(flower, index, errors) {
  if (!flower || typeof flower !== 'object' || Array.isArray(flower)) {
    errors.push(`flowers[${index}] must be an object`);
    return;
  }
  for (const field of ['id', 'flowerId']) {
    if (typeof flower[field] !== 'string' || flower[field].length < 1 || flower[field].length > 64) {
      errors.push(`flowers[${index}].${field} must be a short string`);
    }
  }
  for (const field of ['x', 'y', 'size', 'rotation']) {
    const value = flower[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < -1000 || value > 1000) {
      errors.push(`flowers[${index}].${field} must be a finite number`);
    }
  }
}

// Counts user-perceived characters, not UTF-16 units, so Bangla and emoji are
// not unfairly truncated.
function graphemeSafeLength(text) {
  return [...String(text)].length;
}

export function validateLetterPayload(payload, { partial = false } = {}) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['Request body must be a JSON object'];
  }
  const has = (key) => Object.prototype.hasOwnProperty.call(payload, key);
  const required = (key) => !partial || has(key);

  if (required('recipient') && (typeof payload.recipient !== 'string' || payload.recipient.trim().length < 1 || payload.recipient.trim().length > 255)) {
    errors.push('recipient must be 1-255 characters');
  }
  if (required('content') && (typeof payload.content !== 'string' || payload.content.trim().length < 1 || payload.content.length > config.maxContentLength)) {
    errors.push(`content must be 1-${config.maxContentLength} characters`);
  }
  if (required('sealType') && !SEAL_TYPES.has(payload.sealType)) errors.push('sealType is invalid');
  if (required('sealColor') && !SEAL_COLORS.has(payload.sealColor)) errors.push('sealColor is invalid');

  if (has('salutation') && (typeof payload.salutation !== 'string' || graphemeSafeLength(payload.salutation) > 100)) errors.push('salutation must be at most 100 characters');
  if (has('salutationEnabled') && typeof payload.salutationEnabled !== 'boolean') errors.push('salutationEnabled must be a boolean');
  if (has('closing') && (typeof payload.closing !== 'string' || graphemeSafeLength(payload.closing) > 100)) errors.push('closing must be at most 100 characters');
  if (has('signature') && (typeof payload.signature !== 'string' || graphemeSafeLength(payload.signature) > 255)) errors.push('signature must be at most 255 characters');
  if (has('crest') && !CRESTS.has(payload.crest)) errors.push('crest is invalid');
  if (has('customInitials')) {
    if (typeof payload.customInitials !== 'string' || graphemeSafeLength(payload.customInitials.trim()) > 3) {
      errors.push('customInitials must be at most 3 characters');
    }
  }
  if (has('bodyFont') && !BODY_FONTS.has(payload.bodyFont)) errors.push('bodyFont is invalid');
  if (has('signatureFont') && !SIGNATURE_FONTS.has(payload.signatureFont)) errors.push('signatureFont is invalid');
  if (has('isPrivate') && typeof payload.isPrivate !== 'boolean') errors.push('isPrivate must be a boolean');
  if (has('password') && payload.password !== undefined && payload.password !== null
    && (typeof payload.password !== 'string' || payload.password.length < 1 || payload.password.length > 200)) {
    errors.push('password must be 1-200 characters');
  }
  if (payload.isPrivate === true && !partial
    && (typeof payload.password !== 'string' || payload.password.length < 1)) {
    errors.push('password is required when isPrivate is true');
  }
  if (has('expiresAt') && payload.expiresAt !== undefined && payload.expiresAt !== null) {
    const ts = Date.parse(payload.expiresAt);
    if (!Number.isFinite(ts) || ts <= Date.now()) errors.push('expiresAt must be a future ISO 8601 datetime');
  }
  if (has('flowers')) {
    if (!Array.isArray(payload.flowers)) {
      errors.push('flowers must be an array');
    } else if (payload.flowers.length > config.maxFlowers) {
      // Explicit rejection — flowers are never silently discarded.
      errors.push(`flowers must contain at most ${config.maxFlowers} items`);
    } else {
      payload.flowers.forEach((flower, index) => validateFlower(flower, index, errors));
    }
  }
  return errors;
}
