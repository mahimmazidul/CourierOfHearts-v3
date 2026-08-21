#!/usr/bin/env bash
# Run one encrypted backup now (the systemd timer runs this daily).
set -euo pipefail
CURRENT_HOME="$(getent passwd "$(id -un)" | cut -d: -f6 || echo "$HOME")"
DEPLOY_ROOT="${COH_DEPLOY_ROOT:-$CURRENT_HOME/courierofhearts}"
ENV_FILE="$DEPLOY_ROOT/config/courierofhearts.env"
APP_DIR="$DEPLOY_ROOT/app"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi
cd "${APP_DIR:-.}"
exec node server/tools/backup.mjs
