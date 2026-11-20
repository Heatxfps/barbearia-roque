#!/usr/bin/env bash
# Cópia segura do banco da Barbearia Roque, com o app no ar (SQLite "VACUUM INTO").
# Guarda em ./backups e apaga as cópias com mais de 14 dias.
#   bash deploy/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
ARQ="roque-$(date +%F-%H%M).db"

docker compose exec -T roque node --disable-warning=ExperimentalWarning -e \
  "new (require('node:sqlite').DatabaseSync)('/dados/roque.db').exec(\"VACUUM INTO '/dados/$ARQ'\")"
docker compose cp "roque:/dados/$ARQ" "backups/$ARQ"
docker compose exec -T roque rm -f "/dados/$ARQ"
find backups -name 'roque-*.db' -mtime +14 -delete

echo "$(date '+%F %T')  backup ok: backups/$ARQ ($(du -h "backups/$ARQ" | cut -f1))"
