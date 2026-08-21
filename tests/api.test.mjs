// API integration tests. Boots the real server on a random port with a
// temporary database and a LOCAL mock Telegram server, then exercises the
// full letter lifecycle including recovery-token delivery and use.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4200 + Math.floor(Math.random() * 500);
const TG_PORT = PORT + 1000;
const BASE = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'coh-test-'));

let serverProc;
const telegramMessages = [];
let telegramMock;

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const basePayload = {
  salutation: 'My dearest', salutationEnabled: true, recipient: 'Maria',
  content: '<div>The stars kept your name safe tonight. ❤️ আমি তোমাকে ভালোবাসি</div>',
  closing: 'Forever yours,', signature: 'M', sealType: 'heart', sealColor: 'burgundy',
  crest: 'none', customInitials: 'M·R', bodyFont: 'eb-garamond', signatureFont: 'great-vibes',
  flowers: [{ id: 'f1', flowerId: 'rose', x: 20, y: 30, size: 44, rotation: 5 }],
  isPrivate: false,
};

before(async () => {
  // Local Telegram mock: records messages the backend "sends".
  telegramMock = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { telegramMessages.push(JSON.parse(raw)); } catch { telegramMessages.push({ raw: true }); }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, result: {} }));
    });
  });
  await new Promise((resolve) => telegramMock.listen(TG_PORT, '127.0.0.1', resolve));

  // Legacy v1 JSON store to exercise migration.
  writeFileSync(join(dir, 'letters.json'), JSON.stringify({
    letters: [{
      id: 'legacy-1', slug: 'LegacySlug99', salutation: 'Dear', recipient: 'Old Friend',
      content: 'A letter from the v1 era.', closing: 'Yours,', signature: 'V1',
      sealType: 'rose', sealColor: 'gold', crest: 'none', customInitials: '',
      bodyFont: 'eb-garamond', signatureFont: 'great-vibes', flowers: [],
      isPrivate: false, views: 3, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
    }],
  }));

  serverProc = spawn('node', ['server/index.js'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      BACKEND_PORT: String(PORT),
      DATABASE_PATH: join(dir, 'test.db'),
      LEGACY_JSON_PATH: join(dir, 'letters.json'),
      TELEGRAM_ENABLED: 'true',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: '42',
      TELEGRAM_API_BASE: `http://127.0.0.1:${TG_PORT}`,
      PUBLIC_BASE_URL: 'https://example.test',
      LOG_LEVEL: 'silent',
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not start');
});

after(() => {
  serverProc?.kill('SIGTERM');
  telegramMock?.close();
  rmSync(dir, { recursive: true, force: true });
});

test('health endpoint reports db without leaking internals', async () => {
  const { status, body } = await api('/api/health');
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(body).sort(), ['db', 'status', 'version']);
});

test('create + read a normal letter (content sanitized, slug format)', async () => {
  const { status, body } = await api('/api/v1/letters', {
    method: 'POST',
    body: JSON.stringify({ ...basePayload, content: basePayload.content + '<script>alert(1)</script><img src=x onerror=alert(1)>' }),
  });
  assert.equal(status, 201);
  assert.match(body.data.slug, /^[a-z][a-z-]+-[2-9A-HJKMNP-Za-hjkmnp-z]{8}$/);
  assert.ok(!body.data.content.includes('<script'));
  assert.ok(!body.data.content.includes('onerror'));
  assert.ok(body.data.content.includes('❤️'));
  assert.ok(body.token);

  const read = await api(`/api/v1/letters/${body.data.slug}`);
  assert.equal(read.status, 200);
  assert.equal(read.body.data.recipient, 'Maria');
});

test('protected letter: locked view leaks nothing; password + recovery unlock', async () => {
  telegramMessages.length = 0;
  const { status, body } = await api('/api/v1/letters', {
    method: 'POST',
    body: JSON.stringify({ ...basePayload, isPrivate: true, password: 'rosewater' }),
  });
  assert.equal(status, 201);
  const slug = body.data.slug;

  // Telegram received the notification with the raw recovery token.
  // (Notifications are fire-and-forget; find the protected-letter message.)
  await new Promise((r) => setTimeout(r, 600));
  const protectedMsg = telegramMessages.find((m) => m.text?.includes(slug));
  assert.ok(protectedMsg, 'protected letter notification delivered');
  const text = protectedMsg.text;
  assert.match(text, /Protected: Yes/);
  assert.match(text, /Flowers: 1/);
  assert.match(text, new RegExp(slug));
  assert.ok(!text.includes('rosewater'), 'plaintext password must never reach Telegram');
  const token = /COH-RCV-[A-Z2-9]+/.exec(text)?.[0];
  assert.ok(token, 'recovery token present in Telegram message');

  // Locked view: no recipient/content/salutation.
  const locked = await api(`/api/v1/letters/${slug}`);
  assert.equal(locked.body.data.requiresPassword, true);
  assert.equal(locked.body.data.recipient, undefined);
  assert.equal(locked.body.data.content, undefined);

  // Wrong password.
  const wrong = await api(`/api/v1/letters/${slug}/unlock`, { method: 'POST', body: JSON.stringify({ password: 'nope' }) });
  assert.equal(wrong.status, 403);

  // Correct password.
  const unlocked = await api(`/api/v1/letters/${slug}/unlock`, { method: 'POST', body: JSON.stringify({ password: 'rosewater' }) });
  assert.equal(unlocked.status, 200);
  assert.ok(unlocked.body.data.content.includes('stars'));

  // Recovery token unlock.
  const recovered = await api(`/api/v1/letters/${slug}/recover`, { method: 'POST', body: JSON.stringify({ recoveryToken: token }) });
  assert.equal(recovered.status, 200);
  assert.ok(recovered.body.data.content.includes('stars'));

  // Wrong recovery token.
  const badRecovery = await api(`/api/v1/letters/${slug}/recover`, { method: 'POST', body: JSON.stringify({ recoveryToken: 'COH-RCV-AAAAAAAAAAAAAAAAAAAAAAAAAA' }) });
  assert.equal(badRecovery.status, 403);
});

test('raw recovery token is not stored anywhere in the database', async () => {
  const Database = (await import('better-sqlite3')).default;
  const token = telegramMessages.map((m) => /COH-RCV-[A-Z2-9]+/.exec(m.text || '')?.[0]).find(Boolean);
  assert.ok(token);
  const db = new Database(join(dir, 'test.db'), { readonly: true });
  const rows = db.prepare('SELECT * FROM letters').all();
  db.close();
  const dump = JSON.stringify(rows);
  assert.ok(!dump.includes(token), 'raw recovery token must not appear in the DB');
  assert.ok(!dump.includes('rosewater'), 'plaintext password must not appear in the DB');
  assert.ok(!dump.includes('stars kept your name'), 'letter plaintext must not appear in the DB');
});

test('validation: invalid slug, oversized flowers, bad fields', async () => {
  assert.equal((await api("/api/v1/letters/x' OR '1'='1")).status, 400);
  const tooMany = await api('/api/v1/letters', {
    method: 'POST',
    body: JSON.stringify({ ...basePayload, flowers: Array.from({ length: 301 }, (_, i) => ({ id: `f${i}`, flowerId: 'rose', x: 1, y: 1, size: 44, rotation: 0 })) }),
  });
  assert.equal(tooMany.status, 400);
  assert.match(tooMany.body.error, /at most 300/);
  const badSeal = await api('/api/v1/letters', { method: 'POST', body: JSON.stringify({ ...basePayload, sealType: 'evil' }) });
  assert.equal(badSeal.status, 400);
});

test('management token controls update/delete', async () => {
  const created = await api('/api/v1/letters', { method: 'POST', body: JSON.stringify(basePayload) });
  const { slug } = created.body.data;
  const token = created.body.token;

  const noAuth = await api(`/api/v1/letters/${slug}`, { method: 'DELETE' });
  assert.equal(noAuth.status, 401);

  const updated = await api(`/api/v1/letters/${slug}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ signature: 'Updated' }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.signature, 'Updated');

  const deleted = await api(`/api/v1/letters/${slug}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  assert.equal(deleted.status, 200);
  assert.equal((await api(`/api/v1/letters/${slug}`)).status, 404);
});

test('legacy v1 JSON letters were migrated once, slug preserved', async () => {
  const migrated = await api('/api/v1/letters/LegacySlug99');
  assert.equal(migrated.status, 200);
  assert.equal(migrated.body.data.recipient, 'Old Friend');
  assert.equal(migrated.body.data.content, 'A letter from the v1 era.');
});

test('unlock rate limiting engages', async () => {
  const created = await api('/api/v1/letters', {
    method: 'POST',
    body: JSON.stringify({ ...basePayload, isPrivate: true, password: 'x'.repeat(20) }),
  });
  const slug = created.body.data.slug;
  let limited = false;
  for (let i = 0; i < 12; i++) {
    const attempt = await api(`/api/v1/letters/${slug}/unlock`, { method: 'POST', body: JSON.stringify({ password: `guess${i}` }) });
    if (attempt.status === 429) { limited = true; break; }
  }
  assert.ok(limited, 'expected 429 after repeated unlock attempts');
});
