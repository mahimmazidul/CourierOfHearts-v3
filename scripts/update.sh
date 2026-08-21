#!/usr/bin/env bash
# Manual update: verify -> backup DB -> force-sync app code -> build -> restart.
# No automatic updater exists; run this by hand when you want the newest code.
set -euo pipefail

CURRENT_USER="$(id -un)"
CURRENT_HOME="$(getent passwd "$CURRENT_USER" | cut -d: -f6 || echo "$HOME")"
DEPLOY_ROOT="${COH_DEPLOY_ROOT:-$CURRENT_HOME/courierofhearts}"
APP_DIR="$DEPLOY_ROOT/app"
DB_FILE="$DEPLOY_ROOT/runtime/database/courierofhearts.db"
BACKUP_DIR="$DEPLOY_ROOT/backups"
REPO_URL="${COH_REPO_URL:-https://github.com/mahimmazidul/CourierOfHearts-v3.git}"
BRANCH="${COH_BRANCH:-main}"
SERVICE="courierofhearts-backend"

log()  { printf '\033[1;33m[update]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[update] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }
sudo_or_root() { if [ "$(id -u)" = 0 ]; then "$@"; elif have sudo; then sudo "$@"; else fail "need root for: $*"; fi; }

# 1. verify repository / remote / branch
[ -d "$APP_DIR/.git" ] || fail "no app checkout at $APP_DIR (run setup.sh first)"
cd "$APP_DIR"
[ "$(git remote get-url origin)" = "$REPO_URL" ] || fail "unexpected git remote — refusing to update"
[ "$(git rev-parse --show-toplevel)" = "$APP_DIR" ] || fail "not inside the expected app checkout"

# 2. check for updates
git fetch origin "$BRANCH"
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" = "$REMOTE" ]; then
  log "Already up to date ($LOCAL). Nothing to do."
  exit 0
fi
log "Update available: $LOCAL -> $REMOTE"

# 3. backup + verify DB before touching anything
if [ -f "$DB_FILE" ]; then
  mkdir -p "$BACKUP_DIR"
  SNAP="$BACKUP_DIR/pre-update-$(date +%Y%m%dT%H%M%S).db"
  if have sqlite3; then
    sqlite3 "$DB_FILE" ".backup '$SNAP'"
    [ "$(sqlite3 "$SNAP" 'PRAGMA integrity_check;')" = "ok" ] || fail "backup integrity check failed — aborting update"
  else
    node -e "
      const D = require('better-sqlite3');
      const s = new D('$DB_FILE', { readonly: true });
      s.backup('$SNAP').then(() => {
        const c = new D('$SNAP', { readonly: true });
        const r = c.prepare('PRAGMA integrity_check').get();
        if (r.integrity_check !== 'ok') { console.error('integrity failed'); process.exit(1); }
        console.log('backup verified');
      });"
  fi
  log "Verified DB backup: $SNAP"
fi

# 4. remember previous commit, force-sync (data lives outside the checkout)
echo "$LOCAL" > "$DEPLOY_ROOT/.last-good-commit"
git reset --hard "origin/$BRANCH"

rollback() {
  log "Deployment verification failed — rolling back to $LOCAL"
  git reset --hard "$LOCAL"
  npm ci --no-audit --no-fund
  VITE_BASE=/ npm run build
  sudo_or_root systemctl restart "$SERVICE" 2>/dev/null || true
  fail "rolled back to previous commit $LOCAL"
}

# 5. dependencies, build, restart, verify
npm ci --no-audit --no-fund || rollback
VITE_BASE=/ npm run build || rollback
if have systemctl && [ -d /run/systemd/system ]; then
  sudo_or_root systemctl restart "$SERVICE"
fi
sleep 2
PORT="$(grep -E '^BACKEND_PORT=' "$DEPLOY_ROOT/config/courierofhearts.env" | cut -d= -f2)"
curl -fsS "http://127.0.0.1:${PORT:-3947}/api/health" >/dev/null || rollback

log "Updated to $REMOTE and healthy."
