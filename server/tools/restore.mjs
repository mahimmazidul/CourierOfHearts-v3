// Restore an encrypted backup produced by backup.mjs.
// Usage:
//   node server/tools/restore.mjs <backup.db.enc>            # decrypt + verify only
//   node server/tools/restore.mjs <backup.db.enc> --apply    # atomically replace live DB
// The application should be stopped before --apply (scripts/restore-backup.sh
// handles the stop/start around this tool).
import Database from 'better-sqlite3';
import { createDecipheriv } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { config } from '../config.js';

const MAGIC = Buffer.from('COHBK1');
const log = {
  info: (m) => console.log(`[restore] ${m}`),
  error: (m) => console.error(`[restore] ${m}`),
};

function decryptBackup(encPath, outPath, key) {
  const blob = readFileSync(encPath);
  if (!blob.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Not a CourierOfHearts encrypted backup (bad magic).');
  const iv = blob.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = blob.subarray(MAGIC.length + 12, MAGIC.length + 28);
  const data = blob.subarray(MAGIC.length + 28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  writeFileSync(outPath, Buffer.concat([decipher.update(data), decipher.final()]));
}

function verify(path) {
  const check = new Database(path, { readonly: true });
  try {
    const integrity = check.prepare('PRAGMA integrity_check').get();
    if (integrity.integrity_check !== 'ok') throw new Error(`integrity_check failed: ${integrity.integrity_check}`);
    if (!check.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='letters'").get()) {
      throw new Error('expected table "letters" missing');
    }
    if (!check.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get()) {
      throw new Error('expected table "schema_migrations" missing');
    }
    return check.prepare('SELECT COUNT(*) AS n FROM letters').get().n;
  } finally {
    check.close();
  }
}

const [, , encArg, applyFlag] = process.argv;
if (!encArg) {
  console.error('Usage: node server/tools/restore.mjs <backup.db.enc> [--apply]');
  process.exit(1);
}
if (!config.backup.encryptionKey) {
  log.error('BACKUP_ENCRYPTION_KEY is not set; cannot decrypt.');
  process.exit(1);
}
const encPath = resolve(encArg);
if (!existsSync(encPath)) {
  log.error(`No such file: ${encPath}`);
  process.exit(1);
}

const tmpPath = join(dirname(config.databasePath), `.restore-tmp-${process.pid}.db`);
try {
  decryptBackup(encPath, tmpPath, config.backup.encryptionKey);
  const letters = verify(tmpPath);
  log.info(`Backup decrypts and verifies: ${letters} letter(s).`);

  if (applyFlag === '--apply') {
    mkdirSync(dirname(config.databasePath), { recursive: true });
    if (existsSync(config.databasePath)) {
      const safety = `${config.databasePath}.pre-restore-${Date.now()}`;
      copyFileSync(config.databasePath, safety);
      log.info(`Safety copy of current DB: ${safety}`);
    }
    // Remove stale WAL/SHM so SQLite does not replay old state over the restore.
    rmSync(`${config.databasePath}-wal`, { force: true });
    rmSync(`${config.databasePath}-shm`, { force: true });
    renameSync(tmpPath, config.databasePath); // atomic on same filesystem
    log.info(`Restored database to ${config.databasePath}`);
  } else {
    rmSync(tmpPath, { force: true });
    log.info('Dry run complete (pass --apply to replace the live database).');
  }
} catch (error) {
  rmSync(tmpPath, { force: true });
  log.error(error.message);
  process.exit(1);
}
