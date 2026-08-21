// Central configuration. Reads environment, resolves paths, and refuses to
// start production with insecure defaults.
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

function resolveHome(p) {
  if (!p) return p;
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}

function requireHex32(name, value, { required }) {
  const ok = typeof value === 'string' && /^[0-9a-fA-F]{64}$/.test(value);
  if (!ok && required) {
    throw new Error(
      `${name} must be 64 hex characters (32 bytes). Generate one with: openssl rand -hex 32`
    );
  }
  return ok ? Buffer.from(value, 'hex') : null;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const INSECURE_DEFAULTS = new Set([
  '',
  'change-me-openssl-rand-hex-32',
  'dev-secret-change-me-before-production',
  'dev-master-key-change-me-before-production',
]);

const rawKek = process.env.SERVER_KEK || '';
const rawJwt = process.env.JWT_SECRET || '';

if (isProduction) {
  if (INSECURE_DEFAULTS.has(rawKek)) throw new Error('SERVER_KEK is missing or an insecure default. Refusing to start in production.');
  if (INSECURE_DEFAULTS.has(rawJwt)) throw new Error('JWT_SECRET is missing or an insecure default. Refusing to start in production.');
}

// Development fallback keys are deterministic ONLY outside production so the
// app runs locally without setup; production always requires real secrets.
const serverKek = requireHex32('SERVER_KEK', rawKek, { required: isProduction })
  || Buffer.from('dd'.repeat(32), 'hex');

export const config = {
  nodeEnv: NODE_ENV,
  isProduction,
  host: process.env.BACKEND_HOST || '127.0.0.1',
  port: Number(process.env.BACKEND_PORT || process.env.PORT || 3947),
  publicDomain: process.env.PUBLIC_DOMAIN || 'localhost',
  databasePath: resolve(resolveHome(process.env.DATABASE_PATH || './server/data/courierofhearts.db')),
  legacyJsonPath: resolveHome(process.env.LEGACY_JSON_PATH || './server/data/letters.json'),
  jwtSecret: rawJwt && !INSECURE_DEFAULTS.has(rawJwt) ? rawJwt : 'dev-only-jwt-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '365d',
  serverKek,
  telegram: {
    enabled: String(process.env.TELEGRAM_ENABLED || 'false').toLowerCase() === 'true',
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  backup: {
    encryptionKey: requireHex32('BACKUP_ENCRYPTION_KEY', process.env.BACKUP_ENCRYPTION_KEY || '', { required: false }),
    dir: resolveHome(process.env.BACKUP_DIR || './server/data/backups'),
    retentionDays: Number(process.env.BACKUP_RETENTION_DAYS || 14),
  },
  maxFlowers: Number(process.env.MAX_FLOWERS || 300),
  maxContentLength: Number(process.env.MAX_CONTENT_LENGTH || 40000),
  bodyLimit: Number(process.env.BODY_LIMIT_BYTES || 256 * 1024),
  publicBaseUrl: process.env.PUBLIC_BASE_URL
    || (isProduction ? `https://${process.env.PUBLIC_DOMAIN || 'localhost'}` : 'http://localhost:5173'),
};

export function assertPathIsAbsolute() {
  if (!isAbsolute(config.databasePath)) {
    throw new Error(`DATABASE_PATH must resolve to an absolute path, got: ${config.databasePath}`);
  }
}
