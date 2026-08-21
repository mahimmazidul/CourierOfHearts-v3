#!/usr/bin/env bash
# CourierOfHearts v3 — production setup / update script.
#
# Safe to run repeatedly, on a fresh or existing installation, as root or as
# any non-root user (the CURRENT user is used; no extra Linux user is created).
#
# Layout (Git code is disposable; persistent data lives OUTSIDE the checkout):
#   $DEPLOY_ROOT/app/                      <- git checkout (force-synced)
#   $DEPLOY_ROOT/runtime/database/         <- SQLite (never touched by git)
#   $DEPLOY_ROOT/backups/                  <- encrypted backups
#   $DEPLOY_ROOT/config/courierofhearts.env <- secrets (generated once)
set -euo pipefail

# ------------------------------------------------------------------ context
CURRENT_USER="$(id -un)"
CURRENT_HOME="$(getent passwd "$CURRENT_USER" | cut -d: -f6 || true)"
[ -n "$CURRENT_HOME" ] || CURRENT_HOME="$HOME"

DEPLOY_ROOT="${COH_DEPLOY_ROOT:-$CURRENT_HOME/courierofhearts}"
APP_DIR="$DEPLOY_ROOT/app"
RUNTIME_DIR="$DEPLOY_ROOT/runtime"
DB_DIR="$RUNTIME_DIR/database"
BACKUP_DIR="$DEPLOY_ROOT/backups"
CONFIG_DIR="$DEPLOY_ROOT/config"
ENV_FILE="$CONFIG_DIR/courierofhearts.env"

REPO_URL="${COH_REPO_URL:-https://github.com/mahimmazidul/CourierOfHearts-v3.git}"
BRANCH="${COH_BRANCH:-main}"
PUBLIC_DOMAIN="${COH_DOMAIN:-}"
BACKEND_PORT="${COH_BACKEND_PORT:-3947}"   # "xxx1" — local only, never public
SERVICE_BACKEND="courierofhearts-backend"
SERVICE_BACKUP="courierofhearts-backup"
NGINX_SITE="courierofhearts"

log()  { printf '\033[1;33m[setup]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[setup] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }
is_root() { [ "$(id -u)" = "0" ]; }
sudo_or_root() { if is_root; then "$@"; elif have sudo; then sudo "$@"; else fail "need root privileges for: $*"; fi; }

log "Running as user: $CURRENT_USER (home: $CURRENT_HOME)"
log "Deployment root: $DEPLOY_ROOT"

have git  || fail "git is required"
have node || fail "Node.js (>=20) is required"
have npm  || fail "npm is required"

# ------------------------------------------------------- directories/config
mkdir -p "$APP_DIR" "$DB_DIR" "$BACKUP_DIR" "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR" "$DB_DIR" "$BACKUP_DIR"

if [ ! -f "$ENV_FILE" ]; then
  log "Creating $ENV_FILE with freshly generated secrets (kept out of git)."
  [ -n "$PUBLIC_DOMAIN" ] || { read -r -p "Public domain (e.g. example.com): " PUBLIC_DOMAIN; }
  [ -n "$PUBLIC_DOMAIN" ] || fail "a public domain is required for production"
  umask 077
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PUBLIC_DOMAIN=$PUBLIC_DOMAIN
PUBLIC_BASE_URL=https://$PUBLIC_DOMAIN
BACKEND_HOST=127.0.0.1
BACKEND_PORT=$BACKEND_PORT
DATABASE_PATH=$DB_DIR/courierofhearts.db
SERVER_KEK=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)
BACKUP_DIR=$BACKUP_DIR
BACKUP_RETENTION_DAYS=14
MAX_FLOWERS=300
EOF
  umask 022
  log "IMPORTANT: store a copy of BACKUP_ENCRYPTION_KEY somewhere safe — encrypted backups are useless without it."
else
  log "Existing config found — secrets are NOT regenerated."
  # shellcheck disable=SC1090
  PUBLIC_DOMAIN="$(grep -E '^PUBLIC_DOMAIN=' "$ENV_FILE" | cut -d= -f2)"
  BACKEND_PORT="$(grep -E '^BACKEND_PORT=' "$ENV_FILE" | cut -d= -f2)"
fi

# ------------------------------------------------------------- backup first
backup_db_now() {
  local db="$DB_DIR/courierofhearts.db"
  [ -f "$db" ] || { log "No database yet — skipping pre-update backup."; return 0; }
  local out="$BACKUP_DIR/pre-update-$(date +%Y%m%dT%H%M%S).db"
  if have sqlite3; then
    sqlite3 "$db" ".backup '$out'"
  elif have python3; then
    python3 - "$db" "$out" <<'PY'
import sqlite3, sys
src = sqlite3.connect(sys.argv[1]); dst = sqlite3.connect(sys.argv[2])
src.backup(dst); dst.close(); src.close()
PY
  else
    cp "$db" "$out"
    log "WARNING: neither sqlite3 nor python3 found; used a plain copy for the pre-update backup."
  fi
  if have sqlite3; then
    [ "$(sqlite3 "$out" 'PRAGMA integrity_check;')" = "ok" ] || fail "pre-update backup failed integrity check"
  fi
  log "Pre-update DB backup: $out"
}

# ------------------------------------------------------------- git checkout
sync_repo() {
  if [ ! -d "$APP_DIR/.git" ]; then
    log "Cloning $REPO_URL (branch $BRANCH)..."
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
    return
  fi
  cd "$APP_DIR"
  local remote
  remote="$(git remote get-url origin)"
  [ "$remote" = "$REPO_URL" ] || fail "app dir remote ($remote) does not match expected repo ($REPO_URL). Refusing to force-sync."
  # Extra guard: never run destructive git commands outside the app dir.
  [ "$(git rev-parse --show-toplevel)" = "$APP_DIR" ] || fail "not inside expected app checkout"
  git fetch origin "$BRANCH"
  local local_rev remote_rev
  local_rev="$(git rev-parse HEAD)"
  remote_rev="$(git rev-parse "origin/$BRANCH")"
  if [ "$local_rev" = "$remote_rev" ]; then
    log "App code already at origin/$BRANCH ($local_rev)."
  else
    log "Update available: $local_rev -> $remote_rev"
    backup_db_now
    echo "$local_rev" > "$DEPLOY_ROOT/.last-good-commit"
    git reset --hard "origin/$BRANCH"
  fi
}
sync_repo
cd "$APP_DIR"

# ------------------------------------------------------------ build & deps
log "Installing dependencies (lockfile)..."
npm ci --no-audit --no-fund
log "Building frontend..."
VITE_BASE=/ npm run build
# Migrations run automatically at backend boot; verify the server loads.
node --input-type=module -e "process.env.NODE_ENV='test'; await import('$APP_DIR/server/config.js'); console.log('server config loads');"

# ---------------------------------------------------------------- systemd
NODE_BIN="$(command -v node)"
if have systemctl && [ -d /run/systemd/system ]; then
  log "Configuring systemd services..."
  sudo_or_root tee "/etc/systemd/system/$SERVICE_BACKEND.service" >/dev/null <<EOF
[Unit]
Description=CourierOfHearts v3 backend
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
EnvironmentFile=$ENV_FILE
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN $APP_DIR/server/index.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=$RUNTIME_DIR $BACKUP_DIR

[Install]
WantedBy=multi-user.target
EOF

  sudo_or_root tee "/etc/systemd/system/$SERVICE_BACKUP.service" >/dev/null <<EOF
[Unit]
Description=CourierOfHearts daily encrypted SQLite backup

[Service]
Type=oneshot
User=$CURRENT_USER
EnvironmentFile=$ENV_FILE
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN $APP_DIR/server/tools/backup.mjs
EOF

  sudo_or_root tee "/etc/systemd/system/$SERVICE_BACKUP.timer" >/dev/null <<EOF
[Unit]
Description=Daily CourierOfHearts backup

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=1800
Persistent=true

[Install]
WantedBy=timers.target
EOF

  sudo_or_root systemctl daemon-reload
  sudo_or_root systemctl enable --now "$SERVICE_BACKEND.service"
  sudo_or_root systemctl restart "$SERVICE_BACKEND.service"
  sudo_or_root systemctl enable --now "$SERVICE_BACKUP.timer"
else
  log "systemd not available — skipping service installation (start manually: node server/index.js)."
fi

# ------------------------------------------------------------------ nginx
if have nginx; then
  log "Configuring nginx (domain-only serving; raw IP gets 444)..."
  # Default catch-all: refuse requests that are not for our domain.
  if ! grep -rqs "default_server" /etc/nginx/sites-enabled/ 2>/dev/null; then
    sudo_or_root tee /etc/nginx/sites-available/coh-default-reject >/dev/null <<'EOF'
# Reject any request that does not match a configured server_name.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}
EOF
    sudo_or_root ln -sf /etc/nginx/sites-available/coh-default-reject /etc/nginx/sites-enabled/coh-default-reject
  else
    log "A default_server already exists — leaving it untouched."
  fi

  sudo_or_root tee "/etc/nginx/sites-available/$NGINX_SITE" >/dev/null <<EOF
# CourierOfHearts v3 — static frontend + API proxy. Managed by setup.sh.
server {
    listen 80;
    listen [::]:80;
    server_name $PUBLIC_DOMAIN;

    root $APP_DIR/dist;
    index index.html;

    # Security headers
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 1m;
    }

    # Letter pages: generic share metadata + noindex, never letter content.
    location ~ ^/letter/ {
        add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
        try_files /letter.html =404;
    }
    location = /privacy { try_files /index.html =404; }
    location = /thanks  { try_files /index.html =404; }

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location / {
        try_files \$uri /index.html;
    }
}
EOF
  sudo_or_root ln -sf "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-enabled/$NGINX_SITE"
  sudo_or_root nginx -t
  sudo_or_root systemctl reload nginx 2>/dev/null || sudo_or_root nginx -s reload

  # TLS (optional, non-destructive)
  if have certbot; then
    if sudo_or_root certbot certificates 2>/dev/null | grep -q "$PUBLIC_DOMAIN"; then
      log "Certbot certificate for $PUBLIC_DOMAIN already present."
    else
      log "Requesting TLS certificate via certbot (nginx plugin)..."
      sudo_or_root certbot --nginx -d "$PUBLIC_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
        log "certbot failed (DNS not pointed yet?). Re-run: sudo certbot --nginx -d $PUBLIC_DOMAIN"
    fi
  else
    log "certbot not installed — TLS skipped. Install certbot and run: sudo certbot --nginx -d $PUBLIC_DOMAIN"
  fi
else
  log "nginx not found — skipping reverse proxy configuration."
fi

# --------------------------------------------------------------- firewall
if have ufw && sudo_or_root ufw status | grep -q "Status: active"; then
  log "ufw active — ensuring SSH/80/443 are allowed (no rules are removed)."
  sudo_or_root ufw allow OpenSSH >/dev/null 2>&1 || sudo_or_root ufw allow 22/tcp
  sudo_or_root ufw allow 80/tcp
  sudo_or_root ufw allow 443/tcp
  log "Application ports ($BACKEND_PORT) stay unexposed: services bind to 127.0.0.1 only."
else
  log "ufw not active — firewall untouched. Ensure only SSH/80/443 are publicly reachable."
fi

# ------------------------------------------------------------ health checks
log "Health checks..."
sleep 2
if curl -fsS "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
  log "Backend healthy on 127.0.0.1:$BACKEND_PORT"
else
  fail "Backend health check failed (see: journalctl -u $SERVICE_BACKEND)"
fi
if have nginx; then
  if curl -fsS -H "Host: $PUBLIC_DOMAIN" "http://127.0.0.1/" | grep -qi "courier of hearts"; then
    log "nginx serves the site for Host: $PUBLIC_DOMAIN"
  else
    log "WARNING: nginx did not return the site for the domain host header."
  fi
  code="$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: not-our-domain.invalid' "http://127.0.0.1/" || true)"
  if [ "$code" = "000" ] || [ "$code" = "444" ]; then
    log "Raw-IP/unknown-host requests are rejected (connection dropped)."
  else
    log "WARNING: unknown-host request returned HTTP $code — check the default_server catch-all."
  fi
fi

log "Done. CourierOfHearts v3 is deployed for https://$PUBLIC_DOMAIN"
log "  update:  $APP_DIR/scripts/update.sh"
log "  stop:    $APP_DIR/scripts/stop.sh"
log "  remove:  $APP_DIR/scripts/remove.sh [--purge]"
