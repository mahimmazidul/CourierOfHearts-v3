#!/usr/bin/env bash
# Restart all CourierOfHearts services: backend, backup timer, nginx reload.
# Touches ONLY CourierOfHearts units; nginx is reloaded (never restarted)
# and only after its configuration validates.
set -euo pipefail

CURRENT_HOME="$(getent passwd "$(id -un)" | cut -d: -f6 || echo "$HOME")"
DEPLOY_ROOT="${COH_DEPLOY_ROOT:-$CURRENT_HOME/courierofhearts}"
ENV_FILE="$DEPLOY_ROOT/config/courierofhearts.env"
APP_DIR="$DEPLOY_ROOT/app"

log()  { printf '\033[1;33m[restart]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[restart] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }
sudo_or_root() { if [ "$(id -u)" = 0 ]; then "$@"; elif have sudo; then sudo "$@"; else fail "need root for: $*"; fi; }

BACKEND_PORT=3947
[ -f "$ENV_FILE" ] && BACKEND_PORT="$(grep -E '^BACKEND_PORT=' "$ENV_FILE" | cut -d= -f2 || echo 3947)"

if have systemctl && [ -d /run/systemd/system ]; then
  log "Restarting courierofhearts-backend.service"
  sudo_or_root systemctl restart courierofhearts-backend.service

  if [ -f /etc/systemd/system/courierofhearts-backup.timer ]; then
    log "Ensuring courierofhearts-backup.timer is active"
    sudo_or_root systemctl restart courierofhearts-backup.timer
  fi
else
  log "No systemd — start the backend manually: node $APP_DIR/server/index.js"
fi

if have nginx || [ -x /usr/sbin/nginx ]; then
  export PATH="$PATH:/usr/sbin:/sbin"
  if sudo_or_root nginx -t >/dev/null 2>&1; then
    sudo_or_root systemctl reload nginx 2>/dev/null \
      || sudo_or_root nginx -s reload 2>/dev/null \
      || log "WARNING: nginx reload failed (is nginx running?)"
    log "nginx configuration validated and reloaded."
  else
    log "WARNING: nginx -t failed — NOT reloading. Inspect: sudo nginx -t"
  fi
fi

sleep 2
if curl -fsS "http://127.0.0.1:$BACKEND_PORT/api/health" | grep -q '"db":true'; then
  log "All services restarted — backend healthy on 127.0.0.1:$BACKEND_PORT."
else
  fail "Backend health check failed after restart (see: journalctl -u courierofhearts-backend)"
fi
