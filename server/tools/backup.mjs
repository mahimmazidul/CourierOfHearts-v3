// Daily encrypted SQLite backup tool.
// Usage: node server/tools/backup.mjs
// - Uses SQLite's online backup API (safe against an actively written DB)
// - Verifies the copy (integrity_check + expected tables)
// - Encrypts with AES-256-GCM (BACKUP_ENCRYPTION_KEY) — never sends plaintext
// - Sends the encrypted file to Telegram, applies local retention
import Database from 'better-sqlite3';
import { createCipheriv, randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { config } from '../config.js';
import { sendBackupDocument } from '../telegram.js';

const MAGIC = Buffer.from('COHBK1');
const log = {
  info: (m) => console.log(`[backup] ${m}`),
  warn: (m) => console.warn(`[backup] ${m}`),
  error: (m) => console.error(`[backup] ${m}`),
};

function verifySqliteFile(path) {
  const check = new Database(path, { readonly: true });
  try {
    const integrity = check.prepare('PRAGMA integrity_check').get();
    if (integrity.integrity_check !== 'ok') throw new Error(`integrity_check: ${integrity.integrity_check}`);
    const table = check.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='letters'").get();
    if (!table) throw new Error('expected table "letters" missing');
    const count = check.prepare('SELECT COUNT(*) AS n FROM letters').get();
    return count.n;
  } finally {
    check.close();
  }
}

export function encryptBackup(plainPath, encPath, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(readFileSync(plainPath)), cipher.final()]);
  writeFileSync(encPath, Buffer.concat([MAGIC, iv, cipher.getAuthTag(), data]));
}

function applyRetention(dir, retentionDays) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const name of readdirSync(dir)) {
    // Only files matching our exact backup pattern are ever deleted.
    if (!/^courierofhearts-\d{4}-\d{2}-\d{2}T\d{6}\.db\.enc$/.test(name)) continue;
    const full = join(dir, name);
    try {
      if (statSync(full).mtimeMs < cutoff) {
        rmSync(full);
        removed += 1;
      }
    } catch { /* skip unreadable entries */ }
  }
  if (removed) log.info(`Retention: removed ${removed} old backup(s).`);
}

async function main() {
  if (!config.backup.encryptionKey) {
    log.error('BACKUP_ENCRYPTION_KEY is not set (64 hex chars required). Refusing to create an unencrypted backup.');
    process.exit(1);
  }
  mkdirSync(config.backup.dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:]/g, '').replace(/\..+/, '').replace(/(\d{4}-\d{2}-\d{2})T?/, '$1T');
  const plainTmp = join(config.backup.dir, `.tmp-${process.pid}.db`);
  const encPath = join(config.backup.dir, `courierofhearts-${stamp}.db.enc`);

  const source = new Database(config.databasePath, { readonly: true });
  try {
    await source.backup(plainTmp);
  } finally {
    source.close();
  }

  const letters = verifySqliteFile(plainTmp);
  log.info(`Backup verified: ${letters} letter(s), integrity ok.`);

  try {
    encryptBackup(plainTmp, encPath, config.backup.encryptionKey);
  } finally {
    rmSync(plainTmp, { force: true }); // plaintext copy never lingers
  }
  log.info(`Encrypted backup written: ${encPath}`);

  const sent = await sendBackupDocument(
    encPath,
    basename(encPath),
    `CourierOfHearts encrypted DB backup — ${letters} letter(s), ${new Date().toUTCString()}`,
    log
  );
  if (config.telegram.enabled && !sent) {
    log.warn('Telegram upload failed after retries; encrypted backup remains on disk.');
    process.exitCode = 2;
  } else if (sent) {
    log.info('Encrypted backup delivered to Telegram.');
  }

  applyRetention(config.backup.dir, config.backup.retentionDays);
}

main().catch((error) => {
  log.error(error.message);
  process.exit(1);
});
