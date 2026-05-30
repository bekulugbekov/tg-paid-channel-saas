#!/bin/bash
# Daily PostgreSQL backup via pg_dump
#
# Usage:
#   ./scripts/backup.sh
#
# Cron setup (runs daily at 02:00, appends to log):
#   0 2 * * * cd /opt/tg-saas && ./scripts/backup.sh >> /var/log/tg-saas-backup.log 2>&1
#
# Environment variables (optional overrides):
#   BACKUP_DIR      — where to store backups (default: /var/backups/tg-saas)
#   RETENTION_DAYS  — how many days to keep backups (default: 7)
#   COMPOSE_FILE    — path to docker-compose file (default: ./docker-compose.prod.yml)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/tg-saas}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.prod.yml}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"

# ── Load env vars from .env.production ───────────────────────────────────────
ENV_FILE="${ROOT_DIR}/.env.production"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$')
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-saas}"
POSTGRES_DB="${POSTGRES_DB:-tg_saas}"

# ── Run backup ────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting backup of ${POSTGRES_DB}..."

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$BACKUP_FILE"

SIZE="$(du -sh "$BACKUP_FILE" | cut -f1)"
echo "[$(date -Iseconds)] Backup saved: ${BACKUP_FILE} (${SIZE})"

# ── Remove old backups ────────────────────────────────────────────────────────
DELETED="$(find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete | wc -l)"
echo "[$(date -Iseconds)] Removed ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
