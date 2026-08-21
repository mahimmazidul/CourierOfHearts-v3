#!/usr/bin/env bash
# Stop CourierOfHearts cleanly. Touches ONLY CourierOfHearts services —
# never nginx globally, never unrelated Node processes (no killall/pkill node).
set -euo pipefail

CURRENT_HOME="$(getent passwd "$(id -un)" | cut -d: -f6 || echo "$HOME")"
DEPLOY_ROOT="${COH_DEPLOY_ROOT:-$CURRENT_HOME/courierofhearts}"
ENV_FILE="$DEPLOY_ROOT/config/courierofhearts.env"

log()  { printf '\033[1;33m[stop]\033[0m %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
sudo_or_root() { if [ "$(id -u)" = 0 ]; then "$@"; elif have sudo; then sudo "$@"; else log "skipping (needs root): $*"; fi; }

BACKEND_PORT=3947
[ -f "$ENV_FILE" ] && BACKEND_PORT="$(grep -E '^BACKEND_PORT=' "$ENV_FILE" | cut -d= -f2 || echo 3947)"

if have systemctl && [ -d /run/systemd/system ]; then
  for unit in courierofhearts-backend.service courierofhearts-frontend.service; do
    if systemctl list-unit-files "$unit" >/dev/null 2>&1 && systemctl is-active --quiet "$unit"; then
      log "Stopping $unit"
      sudo_or_root systemctl stop "$unit"
    fi
  done
  if systemctl is-active --quiet courierofhearts-backup.timer 2>/dev/null; then
    log "Stopping courierofhearts-backup.timer"
    sudo_or_root systemctl stop courierofhearts-backup.timer
  fi
else
  # Non-systemd fallback: kill only the process listening on OUR port whose
  # command line is our server entrypoint.
  PID="$(ss -ltnp 2>/dev/null | grep ":$BACKEND_PORT " | grep -oP 'pid=\K[0-9]+' | head -1 || true)"
  if [ -n "${PID:-}" ] && grep -qs "server/index.js" "/proc/$PID/cmdline" 2>/dev/null; then
    log "Stopping CourierOfHearts backend (pid $PID)"
    kill "$PID"
  fi
fi

sleep 1
STILL="$(ss -ltn 2>/dev/null | grep -E ":$BACKEND_PORT " || true)"
if [ -n "$STILL" ]; then
  log "WARNING: port $BACKEND_PORT is still listening:"
  echo "$STILL"
  exit 1
fi
log "CourierOfHearts is stopped. Port $BACKEND_PORT is no longer listening."
log "(nginx was deliberately left running; it may serve other sites.)"
