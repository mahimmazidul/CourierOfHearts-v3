// Telegram integration — backend only. Credentials never reach the frontend.
// Failures never block or roll back letter creation. Raw recovery tokens are
// kept in process memory only and are never logged or persisted.
import { config } from './config.js';

// TELEGRAM_API_BASE exists so the test suite can point at a local mock.
const API = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [2000, 8000];

function enabled() {
  return config.telegram.enabled && config.telegram.botToken && config.telegram.chatId;
}

async function callTelegram(method, body, log) {
  const response = await fetch(`${API}/bot${config.telegram.botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Never include the request body (may contain a recovery token) in logs.
    throw new Error(`Telegram ${method} failed with HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram ${method} returned ok=false (code ${data.error_code || '?'})`);
  return data;
}

async function withRetries(fn, log) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      log?.warn(`Telegram delivery attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message}`);
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
  }
  return null;
}

/**
 * Notify the operator about a new letter. For protected letters this is the
 * ONLY place the raw recovery token ever leaves process memory — by design
 * (documented operator trade-off; see the privacy policy).
 */
export async function notifyNewLetter({ createdAt, url, isProtected, flowerCount, recoveryToken }, log) {
  if (!enabled()) return false;
  const lines = [
    '\u{1F48C} New CourierOfHearts Letter',
    '',
    `Created: ${createdAt}`,
    `Protected: ${isProtected ? 'Yes' : 'No'}`,
    `Flowers: ${flowerCount}`,
    `URL: ${url}`,
  ];
  if (isProtected && recoveryToken) {
    lines.push('', 'Recovery:', recoveryToken);
  }
  const ok = await withRetries(() => callTelegram('sendMessage', {
    chat_id: config.telegram.chatId,
    text: lines.join('\n'),
    disable_web_page_preview: true,
  }, log), log);
  return Boolean(ok);
}

/** Send an (already encrypted) backup file to the operator chat. */
export async function sendBackupDocument(filePath, fileName, caption, log) {
  if (!enabled()) return false;
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.append('chat_id', config.telegram.chatId);
  form.append('caption', caption);
  form.append('document', new Blob([bytes]), fileName);
  const ok = await withRetries(async () => {
    const response = await fetch(`${API}/bot${config.telegram.botToken}/sendDocument`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`Telegram sendDocument failed with HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error('Telegram sendDocument returned ok=false');
    return data;
  }, log);
  return Boolean(ok);
}
