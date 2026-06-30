#!/usr/bin/env bash
# ==============================================================================
# InternOps - Database Restore Script
#
# Restores a PostgreSQL database from an encrypted backup created by backup-db.sh
#
# Usage:
#   ./scripts/restore-db.sh backups/internops_20260115T123456Z.dump.gpg
#   ./scripts/restore-db.sh backups/internops_20260115T123456Z.dump.gpg --dry-run
#
# Prerequisites:
#   - pg_restore (PostgreSQL client tools)
#   - gpg (GnuPG) with the passphrase file used during backup
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load configuration
CONFIG_FILE="$SCRIPT_DIR/backup-config.sh"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: backup-config.sh not found."
  echo "       Copy backup-config.example.sh to backup-config.sh and fill in values."
  exit 1
fi
source "$CONFIG_FILE"

# Parse arguments
BACKUP_FILE="${1:-}"
DRY_RUN=false

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <encrypted-backup-file> [--dry-run]"
  echo ""
  echo "Options:"
  echo "  --dry-run    Show what would be done without making changes"
  exit 1
fi

for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Ensure GPG passphrase file exists
if [[ ! -f "$GPG_PASSPHRASE_FILE" ]]; then
  echo "ERROR: GPG passphrase file not found: $GPG_PASSPHRASE_FILE"
  echo "       Create it with: echo -n 'YOUR_PASSPHRASE' > scripts/backup.key"
  exit 1
fi

TEMP_DIR="${TEMP_DIR:-/tmp/internops-restore}"
mkdir -p "$TEMP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DECRYPTED_FILE="$TEMP_DIR/restore_${TIMESTAMP}.dump"

echo "=== InternOps Database Restore ==="
echo "Source:  $BACKUP_FILE"
echo "Target:  ${DATABASE_URL:-$DB_HOST:$DB_PORT/$DB_NAME}"
echo ""

# Step 1: Decrypt
echo "[1/3] Decrypting backup ..."
gpg --batch --yes --passphrase-file "$GPG_PASSPHRASE_FILE" \
    --decrypt --output "$DECRYPTED_FILE" "$BACKUP_FILE"

# Show dump info
echo "      Decrypted dump size: $(stat -f%z "$DECRYPTED_FILE" 2>/dev/null || stat --printf='%s' "$DECRYPTED_FILE" 2>/dev/null || echo 'unknown') bytes"
echo ""

# Step 2: Restore
echo "[2/3] Restoring database ..."

if [[ "$DRY_RUN" == true ]]; then
  echo "      [DRY RUN] Would execute:"
  echo "      pg_restore --no-owner --no-privileges --clean --if-exists $DECRYPTED_FILE"
else
  if [[ -n "${DATABASE_URL:-}" ]]; then
    pg_restore --no-owner --no-privileges --clean --if-exists \
      "$DATABASE_URL" "$DECRYPTED_FILE" 2>&1
  else
    PGPASSWORD="${DB_PASSWORD:-}" pg_restore \
      -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      --no-owner --no-privileges --clean --if-exists \
      "$DECRYPTED_FILE" 2>&1
  fi
  echo "      Restore complete."
fi

# Step 3: Cleanup
echo ""
echo "[3/3] Cleaning up temporary files ..."
rm -f "$DECRYPTED_FILE"
echo ""

echo "=== Done ==="
