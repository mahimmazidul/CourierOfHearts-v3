// SQLite persistence layer: deterministic migrations, prepared statements,
// WAL, and one-time migration from the legacy v1 JSON store.
import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { nanoid, customAlphabet } from 'nanoid';
import { config } from './config.js';
import {
  generateDek,
  encryptLetterPayload,
  wrapDekWithKek,
} from './crypto.js';

// Unambiguous URL-safe alphabet (no 0/O/1/l/I, no - or _ inside the suffix).
const slugSuffix = customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 8);

mkdirSync(dirname(config.databasePath), { recursive: true });
export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// ---- Migrations ------------------------------------------------------------

const MIGRATIONS = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS letters (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        crypto_version INTEGER NOT NULL DEFAULT 1,
        payload_encrypted TEXT NOT NULL,
        kek_wrapped_dek TEXT,
        password_wrapped_dek TEXT,
        recovery_wrapped_dek TEXT,
        legacy_password_hash TEXT,
        seal_type TEXT NOT NULL,
        seal_color TEXT NOT NULL,
        crest TEXT NOT NULL DEFAULT 'none',
        body_font TEXT NOT NULL DEFAULT 'eb-garamond',
        signature_font TEXT NOT NULL DEFAULT 'great-vibes',
        is_private INTEGER NOT NULL DEFAULT 0,
        views INTEGER NOT NULL DEFAULT 0,
        flower_count INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_letters_created_at ON letters(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_letters_expires_at ON letters(expires_at);
      CREATE TABLE IF NOT EXISTS json_migrations (
        source_file TEXT PRIMARY KEY,
        migrated_at TEXT NOT NULL,
        letters_imported INTEGER NOT NULL
      );
    `,
  },
];

export function runMigrations() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`);
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version));
  const apply = db.transaction((migration) => {
    db.exec(migration.up);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
      .run(migration.version, new Date().toISOString());
  });
  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.version)) apply(migration);
  }
}

export function integrityCheck() {
  const row = db.prepare('PRAGMA integrity_check').get();
  return row && (row.integrity_check === 'ok' || row['integrity_check'] === 'ok');
}

// ---- Statements ------------------------------------------------------------

let statements = null;
function stmts() {
  if (!statements) {
    statements = {
      insert: db.prepare(`INSERT INTO letters (
          id, slug, crypto_version, payload_encrypted, kek_wrapped_dek,
          password_wrapped_dek, recovery_wrapped_dek, legacy_password_hash,
          seal_type, seal_color, crest, body_font, signature_font,
          is_private, views, flower_count, expires_at, created_at, updated_at
        ) VALUES (
          @id, @slug, @crypto_version, @payload_encrypted, @kek_wrapped_dek,
          @password_wrapped_dek, @recovery_wrapped_dek, @legacy_password_hash,
          @seal_type, @seal_color, @crest, @body_font, @signature_font,
          @is_private, @views, @flower_count, @expires_at, @created_at, @updated_at
        )`),
      bySlug: db.prepare('SELECT * FROM letters WHERE slug = ?'),
      update: db.prepare(`UPDATE letters SET
          crypto_version = @crypto_version,
          payload_encrypted = @payload_encrypted,
          kek_wrapped_dek = @kek_wrapped_dek,
          password_wrapped_dek = @password_wrapped_dek,
          recovery_wrapped_dek = @recovery_wrapped_dek,
          legacy_password_hash = @legacy_password_hash,
          seal_type = @seal_type, seal_color = @seal_color, crest = @crest,
          body_font = @body_font, signature_font = @signature_font,
          is_private = @is_private, flower_count = @flower_count,
          expires_at = @expires_at, updated_at = @updated_at
        WHERE slug = @slug`),
      incrementViews: db.prepare('UPDATE letters SET views = views + 1 WHERE slug = ?'),
      remove: db.prepare('DELETE FROM letters WHERE slug = ?'),
      count: db.prepare('SELECT COUNT(*) AS n FROM letters'),
    };
  }
  return statements;
}

export function findLetter(slug) {
  return stmts().bySlug.get(String(slug));
}

export function insertLetter(row) {
  stmts().insert.run(row);
}

export function updateLetter(row) {
  stmts().update.run(row);
}

export function deleteLetter(slug) {
  return stmts().remove.run(slug).changes > 0;
}

export function incrementViews(slug) {
  stmts().incrementViews.run(slug);
  return findLetter(slug)?.views || 0;
}

export function letterCount() {
  return stmts().count.get().n;
}

export function generateSlug() {
  // Generic phrase + random suffix; never derived from letter content.
  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = `a-little-letter-${slugSuffix()}`;
    if (!findLetter(slug)) return slug;
  }
  throw new Error('Could not allocate a unique slug');
}

// ---- Legacy v1 JSON migration ----------------------------------------------
// Non-destructive: the source file is backed up and left in place; a marker
// row in json_migrations prevents double-import. Private legacy letters keep
// their bcrypt hash (crypto_version 0) and are upgraded to the v3 wrap scheme
// on their first successful password unlock.
export function migrateLegacyJson(log = console) {
  const source = config.legacyJsonPath;
  if (!source || !existsSync(source)) return { migrated: 0, skipped: true };
  const already = db.prepare('SELECT 1 FROM json_migrations WHERE source_file = ?').get(source);
  if (already) return { migrated: 0, skipped: true };

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(source, 'utf8'));
  } catch (error) {
    log.error(`Legacy JSON at ${source} is unreadable; skipping migration: ${error.message}`);
    return { migrated: 0, skipped: true };
  }
  const letters = Array.isArray(parsed?.letters) ? parsed.letters : [];
  if (letters.length === 0) {
    db.prepare('INSERT INTO json_migrations (source_file, migrated_at, letters_imported) VALUES (?, ?, 0)')
      .run(source, new Date().toISOString());
    return { migrated: 0, skipped: false };
  }

  copyFileSync(source, `${source}.pre-v3-backup`);

  const now = new Date().toISOString();
  let imported = 0;
  const txn = db.transaction(() => {
    for (const legacy of letters) {
      if (!legacy || typeof legacy.slug !== 'string' || typeof legacy.content !== 'string') continue;
      if (findLetter(legacy.slug)) continue; // preserve old slugs, never overwrite
      const dek = generateDek();
      const payload = {
        v: 1,
        salutation: legacy.salutation || 'My dearest',
        salutationEnabled: true,
        recipient: legacy.recipient || '',
        content: legacy.content,
        closing: legacy.closing || 'Forever yours,',
        signature: legacy.signature || 'With love',
        customInitials: legacy.customInitials || '',
        flowers: Array.isArray(legacy.flowers) ? legacy.flowers : [],
      };
      insertLetter({
        id: legacy.id || nanoid(),
        slug: legacy.slug,
        crypto_version: legacy.isPrivate ? 0 : 1, // 0 = legacy bcrypt-gated
        payload_encrypted: encryptLetterPayload(dek, payload),
        kek_wrapped_dek: wrapDekWithKek(config.serverKek, dek),
        password_wrapped_dek: null,
        recovery_wrapped_dek: null,
        legacy_password_hash: legacy.isPrivate ? legacy.passwordHash || null : null,
        seal_type: legacy.sealType || 'heart',
        seal_color: legacy.sealColor || 'burgundy',
        crest: legacy.crest || 'none',
        body_font: legacy.bodyFont || 'eb-garamond',
        signature_font: legacy.signatureFont || 'great-vibes',
        is_private: legacy.isPrivate ? 1 : 0,
        views: Number(legacy.views) || 0,
        flower_count: Array.isArray(legacy.flowers) ? legacy.flowers.length : 0,
        expires_at: legacy.expiresAt || null,
        created_at: legacy.createdAt || now,
        updated_at: legacy.updatedAt || now,
      });
      dek.fill(0);
      imported += 1;
    }
    db.prepare('INSERT INTO json_migrations (source_file, migrated_at, letters_imported) VALUES (?, ?, ?)')
      .run(source, now, imported);
  });
  txn();
  log.info(`Migrated ${imported} letter(s) from legacy JSON store (${source}).`);
  return { migrated: imported, skipped: false };
}
