# CourierOfHearts v3

*Send a letter worth keeping.*

CourierOfHearts lets you write a letter on aged parchment, decorate it with
hand-drawn flowers, seal it with wax, and send a private link. When your
beloved opens it, the wax waits for their touch — and the words arrive the way
letters used to: slowly, and just for them.

v3 is a production-quality evolution of
[CourierOfHearts](https://github.com/mahimmazidul/CourierOfHearts) (the visual
authority — its design is preserved) and
[CourierOfHearts-v2](https://github.com/mahimmazidul/CourierOfHearts-v2)
(the engineering reference).

---

## Local development

```bash
npm ci
npm run dev          # frontend on http://localhost:5173 (proxies /api)
npm run server       # backend on http://127.0.0.1:3947 (in a second shell)
```

Useful commands:

| command              | what it does                                    |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Vite dev server (with `/api` proxy)             |
| `npm run server`     | Fastify backend (SQLite, migrations run at boot)|
| `npm run build`      | production frontend build → `dist/`             |
| `npm run build:pages`| GitHub Pages demo build (browser-only demo API) |
| `npm run typecheck`  | strict TypeScript check                         |
| `npm test`           | crypto + API integration tests (node:test)      |
| `npm run test:e2e`   | Playwright (chromium, firefox, webkit, mobile)  |
| `npm run backup`     | one encrypted DB backup now                     |

## Production setup (single VPS)

```bash
git clone https://github.com/mahimmazidul/CourierOfHearts-v3.git
cd CourierOfHearts-v3
COH_DOMAIN=example.com ./setup.sh
```

`setup.sh` is idempotent and safe to re-run. It:

1. uses the **current user** (root or non-root — no extra Linux account is created)
   and resolves that user's real home directory;
2. creates the deployment layout (git code is disposable, data is not):

   ```
   ~/courierofhearts/
   ├── app/                      # git checkout — force-synced on update
   ├── runtime/database/         # courierofhearts.db (never touched by git)
   ├── backups/                  # encrypted + pre-update backups
   └── config/courierofhearts.env# secrets — generated once, never regenerated
   ```

3. generates secrets on first run only (`SERVER_KEK`, `JWT_SECRET`,
   `BACKUP_ENCRYPTION_KEY` — store a copy of the backup key off-server!);
4. installs dependencies from the lockfile, builds the frontend;
5. installs systemd units (`courierofhearts-backend.service`,
   `courierofhearts-backup.timer`), an nginx site, and (via certbot, if
   present) TLS;
6. backs up the database before any code update, and health-checks after.

### Network topology

```
             PUBLIC INTERNET
                   |
                 HTTPS
                   |
              example.com
                   |
                 nginx  (ports 80/443 — the ONLY public service)
               /        \
   static files          /api/*
   (app/dist)               |
                     127.0.0.1:3947  ← Fastify backend (localhost only)
                            |
                         SQLite
```

* The frontend is **static files served by nginx** — no frontend process.
* The backend binds to `127.0.0.1` only. `http://SERVER_IP:3947` from outside
  must time out / be refused.
* Requests to the raw IP (any unknown `Host`) hit a `default_server` that
  returns `444` (connection closed). Only `server_name example.com` serves the
  site.
* Frontend JavaScript calls relative `/api/...` — no ports or hosts in
  browser code.
* Firewall: allow SSH, 80, 443 only (setup adds allows to an active ufw but
  never removes rules and never touches SSH access).

### Environment

See `.env.example`. In production the file is
`~/courierofhearts/config/courierofhearts.env`. Production refuses to start
with missing/placeholder `SERVER_KEK` or `JWT_SECRET`.

To enable Telegram set:

```
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=...   # backend-only; never reaches the frontend bundle
TELEGRAM_CHAT_ID=...
```

## Generating the secrets

`setup.sh` generates everything below automatically on first run. If you are
configuring by hand (or rotating a key), this is how each value is made:

| variable | what it is | how to generate |
| --- | --- | --- |
| `SERVER_KEK` | 32-byte key that wraps the per-letter data-encryption keys of unprotected letters | `openssl rand -hex 32` |
| `JWT_SECRET` | signs the author management tokens (edit/delete links) | `openssl rand -hex 32` |
| `BACKUP_ENCRYPTION_KEY` | 32-byte key that encrypts every DB backup before it leaves the server | `openssl rand -hex 32` |
| `TELEGRAM_BOT_TOKEN` | your private notification bot | Telegram → talk to **@BotFather** → `/newbot` → copy the token it gives you |
| `TELEGRAM_CHAT_ID` | the chat the bot posts into | message your new bot once, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and read `message.chat.id` |

No `openssl`? The same 64-hex-character keys can be made with Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Rules that keep the crypto meaningful:

- **Never commit real values** — they live only in
  `~/courierofhearts/config/courierofhearts.env` (mode `600`, outside git).
- **Store an off-server copy of `BACKUP_ENCRYPTION_KEY`** — encrypted backups
  are unreadable without it, which is the entire point.
- **Do not rotate `SERVER_KEK` casually** — existing unprotected letters are
  wrapped with it; rotating requires re-wrapping (not automated).
- Production refuses to boot if `SERVER_KEK`/`JWT_SECRET` are missing or still
  placeholder values.

(Other random values — letter slugs, per-letter DEKs, `COH-RCV-…` recovery
tokens, GCM nonces, Argon2id salts — are generated by the app itself from
`crypto.randomBytes`; nothing to configure.)

## Encryption model

* Every letter body is encrypted at rest with **AES-256-GCM** under its own
  random 32-byte data-encryption key (**DEK**); nonces are unique per
  encryption and crypto blobs are versioned (`v1.`).
* **Unprotected letters**: DEK is wrapped with the server KEK so the server
  can serve the letter.
* **Password-protected letters**: no KEK wrap exists. The DEK is wrapped
  twice —
  1. with a key derived from the passphrase via **Argon2id**
     (64 MiB / t=3 / unique 16-byte salt), and
  2. with a key derived (HKDF-SHA256, unique salt) from a random per-letter
     **recovery token** (`COH-RCV-…`, ~130 bits of entropy).
* The plaintext password is never stored, never logged, never sent to
  Telegram, never in a URL.
* The **raw recovery token is not stored anywhere** — not in SQLite, not on
  disk, not in logs. It is delivered once to the operator's private Telegram
  chat (bounded retries, then discarded from memory). This is an intentional,
  documented trade-off; see `/privacy`.
* There is **no master password**: compromising one recovery token unlocks
  exactly one letter.
* Recovery: the letter unlock screen has a quiet "keeper's key" entrance that
  accepts the recovery token (aggressively rate-limited: 5 attempts/hour/IP).
  There is deliberately no admin dashboard.

## Telegram

After a letter is committed to SQLite (never inside the transaction), the
backend sends a notification: creation time, public URL, protected yes/no,
flower count, and — for protected letters — the raw recovery token. Failures
are retried a bounded number of times and can never block or roll back letter
creation.

## Backups & restore

* `courierofhearts-backup.timer` runs daily: SQLite **online backup** →
  integrity check + expected-table check → **AES-256-GCM encryption**
  (`BACKUP_ENCRYPTION_KEY`) → upload to Telegram → local retention
  (`BACKUP_RETENTION_DAYS`, default 14; only files matching the exact backup
  pattern are ever deleted).
* If encryption is not configured the backup **fails** — an unencrypted file
  is never sent.
* Restore:

  ```bash
  scripts/restore-backup.sh /path/to/courierofhearts-....db.enc
  ```

  validates + decrypts + integrity-checks first (dry run), stops the app,
  keeps a safety copy of the current DB, replaces atomically, restarts, and
  health-checks.

## Updating (manual only)

There is no auto-updater. Run:

```bash
scripts/update.sh
```

It verifies the repo/remote/branch, reports whether an update exists, then:
verified DB backup → remember current commit → `git fetch` +
`git reset --hard origin/main` (the checkout contains no persistent data) →
`npm ci` → build → restart → health check, with rollback to the previous
commit if verification fails.

## Stopping / removing

```bash
scripts/restart.sh           # restart backend + backup timer, reload nginx,
                             # health-check (setup/update run this for you)
scripts/stop.sh              # stops ONLY CourierOfHearts services
scripts/remove.sh            # safe uninstall: keeps DB, backups, secrets
scripts/remove.sh --purge    # full purge (final verified backup first,
                             # explicit confirmation, guarded paths)
```

* `stop.sh` never runs `killall node`/`pkill node` and never stops nginx
  globally.
* `remove.sh` validates every path (absolute, inside the deployment root,
  never `/`, `/home`, `$HOME`, `/etc`, …), removes only
  CourierOfHearts-specific systemd units and nginx site files (with `nginx -t`
  before reload), and never uninstalls shared packages or unrelated TLS
  certificates. Non-interactive automation can use
  `--yes --purge --keep-backups --no-backup` (the latter deliberately
  explicit).

## GitHub Pages preview

`npm run build:pages` (and `.github/workflows/pages.yml` on push) builds a
**frontend-only demo**: `VITE_DEMO_MODE=true` swaps the API layer for a
browser-local store. Demo letters live only in that browser; the demo has no
access to any production API, database, Telegram token, or secret. The Vite
`base` is set to the repository path, so the demo lives at:

```
https://mahimmazidul.github.io/CourierOfHearts-v3/
```

(Enable it once: repo Settings → Pages → Source: "GitHub Actions".)

## SEO & sharing

* Public pages (`/`, `/privacy`, `/thanks`): canonical URL, meta description,
  Open Graph/Twitter cards, JSON-LD, sitemap.
* Letter pages: `noindex,nofollow,noarchive` (meta + `X-Robots-Tag` at nginx),
  excluded from `robots.txt`/sitemap, and served with only generic share
  metadata ("A private letter awaits you 💌") through real HTTP responses —
  crawlers that don't run JavaScript still never see letter content.
* Slugs are `a-little-letter-<8 random chars>` — never derived from names or
  letter content; collision-checked. Legacy `#/letter/<slug>` links keep
  working, and clean `/letter/<slug>` paths work too.

## Data migration from v1

If a v1 `letters.json` is present (`LEGACY_JSON_PATH`), the backend migrates
it once, transactionally: source file is backed up and left in place, old
slugs/IDs are preserved, a marker table prevents double-import. Migrated
password-protected letters keep their bcrypt gate and are upgraded to the v3
wrap scheme (Argon2id + recovery token) automatically on their first
successful unlock.

## Security notes

* All input is validated against strict allowlists; oversized payloads are
  rejected (256 KB body limit); slugs must match `^[A-Za-z0-9_-]{4,64}$`.
* Letter HTML is sanitized **on the server** (tag/style allowlist) and again
  on the client; script/style/iframe content is dropped entirely.
* Rate limits: create 12/15 min, unlock 8/10 min, recovery 5/hour, global
  300/min per IP.
* Prepared statements everywhere; user input never concatenated into SQL.
* Security headers via nginx (CSP without remote origins — all fonts/assets
  are self-hosted — `frame-ancestors 'none'`, nosniff, referrer/permissions
  policies; HSTS once TLS is stable via certbot's config).
* Logs never contain letter bodies, passwords, recovery tokens or Telegram
  credentials.

## Testing

```bash
npm run typecheck   # strict TS
npm test            # 14 crypto/API tests incl. recovery-token lifecycle,
                    # sanitization, rate limiting, legacy JSON migration
npm run test:e2e    # 7 scenarios × chromium/firefox/webkit/mobile-chromium
node tests/responsive-audit.mjs   # 17-viewport overflow/touch-target audit
```

## Troubleshooting

* **Backend won't start in production** — check
  `journalctl -u courierofhearts-backend`; the usual cause is a placeholder
  `SERVER_KEK`/`JWT_SECRET` in the env file.
* **Site not reachable via domain** — `nginx -t`, then check DNS and that the
  `server_name` matches `PUBLIC_DOMAIN`.
* **Raw IP serves nothing** — that is intentional (`return 444`).
* **Backup upload fails** — letter service is unaffected; encrypted backups
  remain in `~/courierofhearts/backups/`. Check the Telegram token/chat id.
* **Lost passphrase** — use the letter's recovery token from the Telegram
  notification via the "keeper's key" entrance on the unlock screen.
