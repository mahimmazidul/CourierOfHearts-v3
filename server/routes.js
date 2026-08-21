// API routes. Prefix /api/v1 (same contract family as v1/v2 for legacy links).
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { config } from './config.js';
import {
  db, findLetter, insertLetter, updateLetter, deleteLetter,
  incrementViews, generateSlug,
} from './db.js';
import {
  generateDek, encryptLetterPayload, decryptLetterPayload,
  wrapDekWithKek, unwrapDekWithKek,
  wrapDekWithPassword, unwrapDekWithPassword,
  generateRecoveryToken, normalizeRecoveryToken,
  wrapDekWithRecoveryToken, unwrapDekWithRecoveryToken,
} from './crypto.js';
import { validateLetterPayload, isValidSlug } from './validation.js';
import { sanitizeLetterHtml, htmlToPlainText } from './sanitize.js';
import { notifyNewLetter } from './telegram.js';

const API_PREFIX = '/api/v1';

function errorReply(reply, statusCode, error, code) {
  return reply.code(statusCode).send({ success: false, error, code });
}

function isExpired(row) {
  return Boolean(row.expires_at && new Date(row.expires_at).getTime() <= Date.now());
}

function tokenFor(slug) {
  return jwt.sign({ slug }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function verifyManagementToken(request, slug) {
  const header = request.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  try {
    const decoded = jwt.verify(match[1], config.jwtSecret);
    return decoded && decoded.slug === slug;
  } catch {
    return false;
  }
}

function lockedView(row) {
  // Deliberately minimal: nothing personal leaves the server while locked.
  return {
    slug: row.slug,
    sealType: row.seal_type,
    sealColor: row.seal_color,
    crest: row.crest,
    bodyFont: row.body_font,
    signatureFont: row.signature_font,
    isPrivate: true,
    requiresPassword: true,
    createdAt: row.created_at,
  };
}

function unlockedView(row, payload) {
  return {
    id: row.id,
    slug: row.slug,
    salutation: payload.salutation,
    salutationEnabled: payload.salutationEnabled !== false,
    recipient: payload.recipient,
    content: payload.content,
    closing: payload.closing,
    signature: payload.signature,
    customInitials: payload.customInitials || '',
    flowers: payload.flowers || [],
    sealType: row.seal_type,
    sealColor: row.seal_color,
    crest: row.crest,
    bodyFont: row.body_font,
    signatureFont: row.signature_font,
    isPrivate: Boolean(row.is_private),
    requiresPassword: false,
    views: row.views || 0,
    expiresAt: row.expires_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildStoredPayload(payload, existing = {}) {
  return {
    v: 1,
    salutation: payload.salutation ?? existing.salutation ?? 'My dearest',
    salutationEnabled: payload.salutationEnabled ?? existing.salutationEnabled ?? true,
    recipient: (payload.recipient ?? existing.recipient ?? '').trim(),
    content: payload.content !== undefined ? sanitizeLetterHtml(payload.content) : existing.content,
    closing: payload.closing ?? existing.closing ?? 'Forever yours,',
    signature: (payload.signature ?? existing.signature ?? 'With love').trim() || 'With love',
    customInitials: (payload.customInitials ?? existing.customInitials ?? '').trim().slice(0, 12),
    flowers: payload.flowers ?? existing.flowers ?? [],
  };
}

const RL = (max, timeWindow) => ({ config: { rateLimit: { max, timeWindow } } });

export function registerRoutes(fastify) {
  const healthHandler = (_request, reply) => {
    let dbOk = false;
    try {
      db.prepare('SELECT 1').get();
      dbOk = true;
    } catch { /* reported below */ }
    reply.code(dbOk ? 200 : 503).send({ status: dbOk ? 'ok' : 'degraded', db: dbOk, version: '3.0.0' });
  };
  fastify.get('/api/health', healthHandler);
  fastify.get(`${API_PREFIX}/health`, healthHandler);

  // ---- Create ---------------------------------------------------------------
  fastify.post(`${API_PREFIX}/letters`, RL(12, '15 minutes'), async (request, reply) => {
    const payload = request.body || {};
    const errors = validateLetterPayload(payload);
    if (errors.length) return errorReply(reply, 400, errors.join('; '), 'VALIDATION_ERROR');

    const cleanContent = sanitizeLetterHtml(payload.content);
    if (!htmlToPlainText(cleanContent)) return errorReply(reply, 400, 'content must not be empty', 'VALIDATION_ERROR');

    const slug = generateSlug();
    const now = new Date().toISOString();
    const stored = buildStoredPayload({ ...payload, content: cleanContent });
    const isProtected = payload.isPrivate === true;

    const dek = generateDek();
    let recoveryToken = null; // raw token: process memory only, never persisted
    const row = {
      id: nanoid(),
      slug,
      crypto_version: 1,
      payload_encrypted: encryptLetterPayload(dek, stored),
      kek_wrapped_dek: null,
      password_wrapped_dek: null,
      recovery_wrapped_dek: null,
      legacy_password_hash: null,
      seal_type: payload.sealType,
      seal_color: payload.sealColor,
      crest: payload.crest || 'none',
      body_font: payload.bodyFont || 'eb-garamond',
      signature_font: payload.signatureFont || 'great-vibes',
      is_private: isProtected ? 1 : 0,
      views: 0,
      flower_count: stored.flowers.length,
      expires_at: payload.expiresAt || null,
      created_at: now,
      updated_at: now,
    };

    if (isProtected) {
      recoveryToken = generateRecoveryToken();
      row.password_wrapped_dek = await wrapDekWithPassword(dek, payload.password);
      row.recovery_wrapped_dek = wrapDekWithRecoveryToken(dek, recoveryToken);
    } else {
      row.kek_wrapped_dek = wrapDekWithKek(config.serverKek, dek);
    }
    dek.fill(0);

    insertLetter(row);

    // Telegram is intentionally OUTSIDE the DB transaction: its failure never
    // rolls back the letter. Raw recovery token is handed over and dropped.
    const letterUrl = `${config.publicBaseUrl}/letter/${slug}`;
    const tokenForTelegram = recoveryToken;
    recoveryToken = null;
    notifyNewLetter({
      createdAt: now,
      url: letterUrl,
      isProtected,
      flowerCount: row.flower_count,
      recoveryToken: tokenForTelegram,
    }, request.log).catch(() => { /* already logged, sanitized */ });

    const responseData = isProtected
      ? { ...unlockedView(row, stored) } // author just wrote it; show it back once
      : unlockedView(row, stored);
    reply.code(201).send({ success: true, data: responseData, token: tokenFor(slug) });
  });

  // ---- List (author's own slugs) --------------------------------------------
  fastify.get(`${API_PREFIX}/letters`, RL(60, '1 minute'), async (request, reply) => {
    const slugs = String(request.query?.slugs || '')
      .split(',').map((s) => s.trim()).filter((s) => isValidSlug(s)).slice(0, 100);
    const data = [];
    for (const slug of slugs) {
      const row = findLetter(slug);
      if (!row || isExpired(row)) continue;
      if (row.is_private) {
        data.push(lockedView(row));
      } else {
        try {
          const dek = unwrapDekWithKek(config.serverKek, row.kek_wrapped_dek);
          data.push(unlockedView(row, decryptLetterPayload(dek, row.payload_encrypted)));
          dek.fill(0);
        } catch (error) {
          request.log.error(`Decrypt failed for slug ${slug}: ${error.message}`);
        }
      }
    }
    reply.send({ success: true, data });
  });

  // ---- Read -----------------------------------------------------------------
  fastify.get(`${API_PREFIX}/letters/:slug`, RL(120, '1 minute'), async (request, reply) => {
    const { slug } = request.params;
    if (!isValidSlug(slug)) return errorReply(reply, 400, 'Invalid letter id', 'VALIDATION_ERROR');
    const row = findLetter(slug);
    if (!row) return errorReply(reply, 404, 'Letter not found', 'LETTER_NOT_FOUND');
    if (isExpired(row)) return errorReply(reply, 410, 'This letter has faded with time', 'LETTER_EXPIRED');
    if (row.is_private) return reply.send({ success: true, data: lockedView(row) });
    try {
      const dek = unwrapDekWithKek(config.serverKek, row.kek_wrapped_dek);
      const payload = decryptLetterPayload(dek, row.payload_encrypted);
      dek.fill(0);
      return reply.send({ success: true, data: unlockedView(row, payload) });
    } catch (error) {
      request.log.error(`Decrypt failed for slug ${slug}: ${error.message}`);
      return errorReply(reply, 500, 'Letter could not be opened', 'DECRYPT_ERROR');
    }
  });

  // ---- Unlock with password --------------------------------------------------
  fastify.post(`${API_PREFIX}/letters/:slug/unlock`, RL(8, '10 minutes'), async (request, reply) => {
    const { slug } = request.params;
    if (!isValidSlug(slug)) return errorReply(reply, 400, 'Invalid letter id', 'VALIDATION_ERROR');
    const row = findLetter(slug);
    if (!row) return errorReply(reply, 404, 'Letter not found', 'LETTER_NOT_FOUND');
    if (isExpired(row)) return errorReply(reply, 410, 'This letter has faded with time', 'LETTER_EXPIRED');

    const password = request.body?.password;
    if (!row.is_private) {
      const dek = unwrapDekWithKek(config.serverKek, row.kek_wrapped_dek);
      const payload = decryptLetterPayload(dek, row.payload_encrypted);
      dek.fill(0);
      return reply.send({ success: true, data: unlockedView(row, payload) });
    }
    if (typeof password !== 'string' || password.length < 1 || password.length > 200) {
      return errorReply(reply, 400, 'password is required', 'VALIDATION_ERROR');
    }

    // Legacy letters migrated from v1 JSON: bcrypt-gated, KEK-encrypted.
    if (row.crypto_version === 0 && row.legacy_password_hash) {
      const ok = await bcrypt.compare(password, row.legacy_password_hash);
      if (!ok) return errorReply(reply, 403, 'Incorrect passphrase', 'WRONG_PASSWORD');
      const dek = unwrapDekWithKek(config.serverKek, row.kek_wrapped_dek);
      const payload = decryptLetterPayload(dek, row.payload_encrypted);
      // One-time upgrade to the v3 wrap scheme now that we hold the password.
      try {
        const recoveryToken = generateRecoveryToken();
        updateLetter({
          ...row,
          crypto_version: 1,
          kek_wrapped_dek: null,
          legacy_password_hash: null,
          password_wrapped_dek: await wrapDekWithPassword(dek, password),
          recovery_wrapped_dek: wrapDekWithRecoveryToken(dek, recoveryToken),
          updated_at: new Date().toISOString(),
        });
        notifyNewLetter({
          createdAt: row.created_at,
          url: `${config.publicBaseUrl}/letter/${slug}`,
          isProtected: true,
          flowerCount: row.flower_count,
          recoveryToken,
        }, request.log).catch(() => {});
        request.log.info(`Upgraded legacy letter ${slug} to v3 crypto scheme`);
      } catch (error) {
        request.log.error(`Legacy crypto upgrade failed for ${slug}: ${error.message}`);
      }
      dek.fill(0);
      return reply.send({ success: true, data: unlockedView(row, payload) });
    }

    try {
      const dek = await unwrapDekWithPassword(row.password_wrapped_dek, password);
      const payload = decryptLetterPayload(dek, row.payload_encrypted);
      dek.fill(0);
      return reply.send({ success: true, data: unlockedView(row, payload) });
    } catch {
      // GCM auth failure == wrong password. No details leak.
      return errorReply(reply, 403, 'Incorrect passphrase', 'WRONG_PASSWORD');
    }
  });

  // ---- Recovery (operator, per-letter token) ---------------------------------
  fastify.post(`${API_PREFIX}/letters/:slug/recover`, RL(5, '1 hour'), async (request, reply) => {
    const { slug } = request.params;
    if (!isValidSlug(slug)) return errorReply(reply, 400, 'Invalid letter id', 'VALIDATION_ERROR');
    const row = findLetter(slug);
    // Deliberately identical error for missing letter / wrong token.
    const fail = () => errorReply(reply, 403, 'Recovery failed', 'RECOVERY_FAILED');
    if (!row || !row.is_private || !row.recovery_wrapped_dek) return fail();
    const token = normalizeRecoveryToken(request.body?.recoveryToken);
    if (!/^COH-RCV-[A-Z2-9]{20,40}$/.test(token)) return fail();
    try {
      const dek = unwrapDekWithRecoveryToken(row.recovery_wrapped_dek, token);
      const payload = decryptLetterPayload(dek, row.payload_encrypted);
      dek.fill(0);
      request.log.info(`Recovery unlock used for letter ${slug}`);
      return reply.send({ success: true, data: unlockedView(row, payload) });
    } catch {
      return fail();
    }
  });

  // ---- Views ------------------------------------------------------------------
  fastify.post(`${API_PREFIX}/letters/:slug/view`, RL(60, '1 minute'), async (request, reply) => {
    const { slug } = request.params;
    if (!isValidSlug(slug)) return errorReply(reply, 400, 'Invalid letter id', 'VALIDATION_ERROR');
    const row = findLetter(slug);
    if (!row) return errorReply(reply, 404, 'Letter not found', 'LETTER_NOT_FOUND');
    if (isExpired(row)) return errorReply(reply, 410, 'This letter has faded with time', 'LETTER_EXPIRED');
    reply.send({ success: true, views: incrementViews(slug) });
  });

  // ---- Update (author, management token) ---------------------------------------
  fastify.put(`${API_PREFIX}/letters/:slug`, RL(30, '15 minutes'), async (request, reply) => {
    const { slug } = request.params;
    if (!isValidSlug(slug)) return errorReply(reply, 400, 'Invalid letter id', 'VALIDATION_ERROR');
    if (!verifyManagementToken(request, slug)) return errorReply(reply, 401, 'Unauthorized', 'UNAUTHORIZED');
    const row = findLetter(slug);
    if (!row) return errorReply(reply, 404, 'Letter not found', 'LETTER_NOT_FOUND');
    if (isExpired(row)) return errorReply(reply, 410, 'This letter has faded with time', 'LETTER_EXPIRED');

    const payload = request.body || {};
    const errors = validateLetterPayload(payload, { partial: true });
    if (errors.length) return errorReply(reply, 400, errors.join('; '), 'VALIDATION_ERROR');

    // Obtain the letter's DEK. Protected letters require the current password
    // (the server holds no KEK wrap for them).
    let dek;
    if (row.is_private) {
      if (row.crypto_version === 0 && row.legacy_password_hash) {
        const ok = typeof payload.password === 'string' && await bcrypt.compare(payload.password, row.legacy_password_hash);
        if (!ok) return errorReply(reply, 403, 'Password required to edit a protected letter', 'PASSWORD_REQUIRED');
        dek = unwrapDekWithKek(config.serverKek, row.kek_wrapped_dek);
      } else {
        if (typeof payload.password !== 'string') return errorReply(reply, 403, 'Password required to edit a protected letter', 'PASSWORD_REQUIRED');
        try {
          dek = await unwrapDekWithPassword(row.password_wrapped_dek, payload.password);
        } catch {
          return errorReply(reply, 403, 'Incorrect passphrase', 'WRONG_PASSWORD');
        }
      }
    } else {
      dek = unwrapDekWithKek(config.serverKek, row.kek_wrapped_dek);
    }

    const existing = decryptLetterPayload(dek, row.payload_encrypted);
    const nextStored = buildStoredPayload(payload, existing);
    const next = {
      ...row,
      payload_encrypted: encryptLetterPayload(dek, nextStored),
      seal_type: payload.sealType || row.seal_type,
      seal_color: payload.sealColor || row.seal_color,
      crest: payload.crest || row.crest,
      body_font: payload.bodyFont || row.body_font,
      signature_font: payload.signatureFont || row.signature_font,
      flower_count: nextStored.flowers.length,
      expires_at: payload.expiresAt === undefined ? row.expires_at : (payload.expiresAt || null),
      updated_at: new Date().toISOString(),
    };
    updateLetter(next);
    dek.fill(0);
    reply.send({ success: true, data: unlockedView(next, nextStored) });
  });

  // ---- Delete -------------------------------------------------------------------
  fastify.delete(`${API_PREFIX}/letters/:slug`, RL(30, '15 minutes'), async (request, reply) => {
    const { slug } = request.params;
    if (!isValidSlug(slug)) return errorReply(reply, 400, 'Invalid letter id', 'VALIDATION_ERROR');
    if (!verifyManagementToken(request, slug)) return errorReply(reply, 401, 'Unauthorized', 'UNAUTHORIZED');
    if (!deleteLetter(slug)) return errorReply(reply, 404, 'Letter not found', 'LETTER_NOT_FOUND');
    reply.send({ success: true, data: { slug, deleted: true } });
  });
}
