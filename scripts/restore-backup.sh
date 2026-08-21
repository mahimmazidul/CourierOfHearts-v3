#!/usr/bin/env bash
# Restore an encrypted backup produced by backup.mjs.
# Usage: scripts/restore-backup.sh <backup.db.enc>
#
# Workflow: validate + decrypt + integrity-check (dry run) -> stop app ->
# safety-copy current DB -> atomic replace -> start app -> health check.
set -euo pipefail

BACKUP_FILE="${1:-}"
[ -n "$BACKUP_FILE" ] || { echo "Usage: $0 <backup.db.enc>"; exit 1; }
[ -f "$BACKUP_FILE" ] || { echo "No such file: $BACKUP_FILE"; exit 1; }

CURRENT_HOME="$(getent passwd "$(id -un)" | cut -d: -f6 || echo "$HOME")"
DEPLOY_ROOT="${COH_DEPLOY_ROOT:-$CURRENT_HOME/courierofhearts}"
ENV_FILE="$DEPLOY_ROOT/config/courierofhearts.env"
APP_DIR="$DEPLOY_ROOT/app"
SERVICE="courierofhearts-backend"

log()  { printf '\033[1;33m[restore]\033[0m %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
sudo_or_root() { if [ "$(id -u)" = 0 ]; then "$@"; elif have sudo; then sudo "$@"; else log "skipping (needs root): $*"; fi; }

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi
cd "$APP_DIR"

# 1-3. validate + decrypt + integrity check (dry run, no changes yet)
node server/tools/restore.mjs "$BACKUP_FILE"

# 4. stop application
if have systemctl && [ -d /run/systemd/system ]; then
  sudo_or_root systemctl stop "$SERVICE"
else
  "$APP_DIR/scripts/stop.sh" || true
fi

# 5-7. safety copy + atomic replace + schema verification (inside the tool)
node server/tools/restore.mjs "$BACKUP_FILE" --apply

# 8. start application
if have systemctl && [ -d /run/systemd/system ]; then
  sudo_or_root systemctl start "$SERVICE"
else
  log "systemd not available — start manually: node server/index.js"
fi

# 9-10. health check + letter retrieval sanity
sleep 2
PORT="${BACKEND_PORT:-3947}"
if curl -fsS "http://127.0.0.1:$PORT/api/health" | grep -q '"db":true'; then
  log "Restore complete and backend healthy."
else
  log "WARNING: health check failed after restore — investigate before trusting this restore."
  exit 1
fi
