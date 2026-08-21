#!/usr/bin/env bash
# Safely uninstall CourierOfHearts from this machine.
#
# Default (safe) mode:
#   - stop services, remove systemd units, remove nginx site, remove app code
#   - KEEPS database, backups, and config/secrets
#
# Full purge (explicit): ./remove.sh --purge [--yes]
#   - additionally removes runtime/database, backups and config,
#     but only AFTER creating and verifying a final backup
#
# Flags: --purge --yes --keep-backups --no-backup (deliberate use only)
#
# Never uninstalls shared packages (nginx, node, certbot, sqlite3, git...).
set -euo pipefail

PURGE=false; ASSUME_YES=false; KEEP_BACKUPS=false; NO_BACKUP=false
for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=true ;;
    --yes) ASSUME_YES=true ;;
    --keep-backups) KEEP_BACKUPS=true ;;
    --no-backup) NO_BACKUP=true ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

CURRENT_USER="$(id -un)"
CURRENT_HOME="$(getent passwd "$CURRENT_USER" | cut -d: -f6 || echo "$HOME")"
DEPLOY_ROOT="${COH_DEPLOY_ROOT:-$CURRENT_HOME/courierofhearts}"

log()  { printf '\033[1;33m[remove]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[remove] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }
sudo_or_root() { if [ "$(id -u)" = 0 ]; then "$@"; elif have sudo; then sudo "$@"; else log "skipping (needs root): $*"; fi; }

# ---------------------------------------------------------- path validation
# Every deletion goes through this guard. Nothing gets removed unless the
# path is a real, absolute subdirectory of the verified deployment root.
FORBIDDEN=( "/" "/root" "/home" "/etc" "/var" "/usr" "/bin" "/sbin" "/lib" "/opt" "/srv" "$CURRENT_HOME" )
validate_subpath() {
  local p="$1"
  [ -n "$p" ] || fail "refusing to delete: empty path"
  local abs
  abs="$(readlink -f "$p" 2>/dev/null || true)"
  [ -n "$abs" ] || fail "refusing to delete: cannot resolve $p"
  for bad in "${FORBIDDEN[@]}"; do
    [ "$abs" = "$(readlink -f "$bad" 2>/dev/null || echo "$bad")" ] && fail "refusing to delete protected path: $abs"
  done
  case "$abs" in
    "$DEPLOY_ROOT"/*) ;;
    *) fail "refusing to delete path outside deployment root: $abs" ;;
  esac
  echo "$abs"
}
safe_rm() {
  local target
  target="$(validate_subpath "$1")"
  rm -rf --one-file-system "$target"
  log "removed: $target"
}

# ------------------------------------------------------- verify installation
[ -d "$DEPLOY_ROOT" ] || fail "no CourierOfHearts installation at $DEPLOY_ROOT"
if [ ! -d "$DEPLOY_ROOT/app" ] && [ ! -d "$DEPLOY_ROOT/runtime" ] && [ ! -d "$DEPLOY_ROOT/config" ]; then
  fail "$DEPLOY_ROOT does not look like a CourierOfHearts installation (missing app/runtime/config markers)"
fi
if [ -d "$DEPLOY_ROOT/app" ] && [ ! -f "$DEPLOY_ROOT/app/server/index.js" ] && [ ! -f "$DEPLOY_ROOT/app/package.json" ]; then
  fail "app directory exists but lacks CourierOfHearts markers — refusing to continue"
fi

if [ "$PURGE" = true ] && [ "$ASSUME_YES" != true ]; then
  echo "FULL PURGE will delete the database, backups and secrets under $DEPLOY_ROOT."
  read -r -p "Type 'purge courierofhearts' to confirm: " answer
  [ "$answer" = "purge courierofhearts" ] || fail "confirmation did not match — aborting"
fi

DB_FILE="$DEPLOY_ROOT/runtime/database/courierofhearts.db"

# ----------------------------------------------------------- final backup
if [ "$NO_BACKUP" != true ] && [ -f "$DB_FILE" ]; then
  FINAL="$DEPLOY_ROOT/backups/final-backup-$(date +%Y%m%dT%H%M%S).db"
  mkdir -p "$DEPLOY_ROOT/backups"
  if have sqlite3; then
    sqlite3 "$DB_FILE" ".backup '$FINAL'"
    [ "$(sqlite3 "$FINAL" 'PRAGMA integrity_check;')" = "ok" ] || fail "final backup failed integrity check — aborting removal"
  else
    cp "$DB_FILE" "$FINAL"
  fi
  log "Final verified backup: $FINAL"
  if [ "$PURGE" = true ] && [ "$KEEP_BACKUPS" != true ]; then
    ESCAPE_DIR="$CURRENT_HOME/courierofhearts-final-backup-$(date +%Y%m%dT%H%M%S)"
    mkdir -p "$ESCAPE_DIR"
    cp "$FINAL" "$ESCAPE_DIR/"
    log "Purge requested: a copy of the final backup was placed OUTSIDE the purge area: $ESCAPE_DIR"
  fi
elif [ "$NO_BACKUP" = true ]; then
  log "--no-backup given: skipping final backup (deliberate operator choice)."
fi

# ----------------------------------------------------------- stop services
if [ -x "$DEPLOY_ROOT/app/scripts/stop.sh" ]; then
  "$DEPLOY_ROOT/app/scripts/stop.sh" || true
fi

# ------------------------------------------------------ systemd unit removal
if have systemctl && [ -d /run/systemd/system ]; then
  for unit in courierofhearts-backend.service courierofhearts-frontend.service \
              courierofhearts-backup.service courierofhearts-backup.timer; do
    if [ -f "/etc/systemd/system/$unit" ]; then
      log "Removing systemd unit $unit"
      sudo_or_root systemctl disable --now "$unit" 2>/dev/null || true
      sudo_or_root rm -f "/etc/systemd/system/$unit"
    fi
  done
  sudo_or_root systemctl daemon-reload
fi

# ---------------------------------------------------------- nginx site only
if have nginx; then
  removed=false
  for f in /etc/nginx/sites-enabled/courierofhearts /etc/nginx/sites-available/courierofhearts \
           /etc/nginx/sites-enabled/coh-default-reject /etc/nginx/sites-available/coh-default-reject; do
    if [ -e "$f" ]; then
      sudo_or_root rm -f "$f"
      log "removed nginx config: $f"
      removed=true
    fi
  done
  if [ "$removed" = true ]; then
    if sudo_or_root nginx -t; then
      sudo_or_root systemctl reload nginx 2>/dev/null || sudo_or_root nginx -s reload || true
    else
      log "WARNING: nginx -t failed after removal; NOT reloading. Inspect /etc/nginx manually."
    fi
  fi
  log "TLS certificates were NOT touched. To delete them explicitly: sudo certbot delete"
fi

# -------------------------------------------------------------- file removal
safe_rm "$DEPLOY_ROOT/app"
if [ "$PURGE" = true ]; then
  [ -d "$DEPLOY_ROOT/runtime" ] && safe_rm "$DEPLOY_ROOT/runtime"
  if [ "$KEEP_BACKUPS" = true ]; then
    log "keeping backups: $DEPLOY_ROOT/backups"
  else
    [ -d "$DEPLOY_ROOT/backups" ] && safe_rm "$DEPLOY_ROOT/backups"
  fi
  [ -d "$DEPLOY_ROOT/config" ] && safe_rm "$DEPLOY_ROOT/config"
  rm -f "$DEPLOY_ROOT/.last-good-commit"
  rmdir "$DEPLOY_ROOT" 2>/dev/null && log "removed empty deployment root" || log "deployment root left (not empty)"
else
  log "Safe uninstall complete. Preserved: database, backups, config/secrets under $DEPLOY_ROOT"
fi

# -------------------------------------------------------------- verification
ENV_PORT=3947
[ -f "$DEPLOY_ROOT/config/courierofhearts.env" ] && ENV_PORT="$(grep -E '^BACKEND_PORT=' "$DEPLOY_ROOT/config/courierofhearts.env" | cut -d= -f2 || echo 3947)"
if ss -ltn 2>/dev/null | grep -qE ":$ENV_PORT "; then
  log "WARNING: port $ENV_PORT still listening after removal."
else
  log "Verified: application port $ENV_PORT is no longer listening."
fi
log "CourierOfHearts removal finished. Shared packages (nginx/node/certbot/etc.) were not uninstalled."
