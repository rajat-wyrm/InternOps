#!/usr/bin/env bash
# ==============================================================================
# InternOps - Encrypted Database Backup Script
#
# Dumps PostgreSQL, compresses, encrypts with GPG, uploads to S3, and
# applies a rotation policy to expire old backups.
#
# Usage:
#   ./scripts/backup-db.sh                    # Full backup
#   ./scripts/backup-db.sh --no-upload        # Local-only (skip S3)
#   ./scripts/backup-db.sh --restore FILE     # Restore from encrypted backup
#   ./scripts/backup-db.sh --list             # List available backups in S3
#
# Prerequisites:
#   - pg_dump (PostgreSQL client tools)
#   - gpg (GnuPG)
#   - aws-cli (configured with credentials)
# ==============================================================================
set -euo pipefail

# --------------- Resolve script directory -------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --------------- Load configuration -------------------------------------------
CONFIG_FILE="$SCRIPT_DIR/backup-config.sh"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: backup-config.sh not found."
  echo "       Copy backup-config.example.sh to backup-config.sh and fill in values."
  exit 1
fi
# shellcheck source=backup-config.example.sh
source "$CONFIG_FILE"

# --------------- Ensure required tools are available --------------------------
for cmd in pg_dump gpg aws; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: Required command '$cmd' not found in PATH."
    exit 1
  fi
done

# --------------- Parse arguments ----------------------------------------------
MODE="backup"
RESTORE_FILE=""
NO_UPLOAD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --restore)
      MODE="restore"
      RESTORE_FILE="${2:-}"
      if [[ -z "$RESTORE_FILE" ]]; then
        echo "ERROR: --restore requires a file path."
        exit 1
      fi
      shift 2
      ;;
    --no-upload)
      NO_UPLOAD=true
      shift
      ;;
    --list)
      MODE="list"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--no-upload] [--restore FILE] [--list]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# --------------- Logging ------------------------------------------------------
mkdir -p "$LOG_DIR" "$TEMP_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/backup-${TIMESTAMP}.log"

log() {
  local msg="[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*"
  echo "$msg" | tee -a "$LOG_FILE"
}

log "===== InternOps Backup Started ====="
log "Mode: $MODE"

# --------------- Build pg_dump command ----------------------------------------
build_pg_cmd() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    # Use connection string directly
    echo "pg_dump --no-owner --no-privileges --format=custom"
    return
  fi
  # Fall back to individual flags
  PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner --no-privileges --format=custom
}

build_pg_restore_cmd() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "pg_restore --no-owner --no-privileges --clean --if-exists"
    return
  fi
  echo "PGPASSWORD=${DB_PASSWORD:-} pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --no-owner --no-privileges --clean --if-exists"
}

# --------------- LIST MODE ----------------------------------------------------
if [[ "$MODE" == "list" ]]; then
  log "Listing backups in $S3_BUCKET ..."
  aws s3 ls "$S3_BUCKET/" --recursive --human-readable --region "$AWS_REGION" 2>&1 | tee -a "$LOG_FILE"
  log "===== Done ====="
  exit 0
fi

# --------------- RESTORE MODE -------------------------------------------------
if [[ "$MODE" == "restore" ]]; then
  if [[ ! -f "$RESTORE_FILE" ]]; then
    log "ERROR: Restore file not found: $RESTORE_FILE"
    exit 1
  fi

  DECRYPTED_FILE="$TEMP_DIR/restore-$(basename "$RESTORE_FILE" .gpg).dump"

  log "Decrypting backup: $RESTORE_FILE"

  if [[ -f "$GPG_PASSPHRASE_FILE" ]]; then
    gpg --batch --yes --passphrase-file "$GPG_PASSPHRASE_FILE" \
        --decrypt --output "$DECRYPTED_FILE" "$RESTORE_FILE"
  else
    gpg --batch --yes --symmetric --output "$DECRYPTED_FILE" "$RESTORE_FILE"
  fi

  log "Restoring database from $DECRYPTED_FILE ..."
  RESTORE_CMD=$(build_pg_restore_cmd)
  eval "$RESTORE_CMD" "$DECRYPTED_FILE" 2>&1 | tee -a "$LOG_FILE"

  rm -f "$DECRYPTED_FILE"
  log "===== Restore Complete ====="
  exit 0
fi

# --------------- BACKUP MODE --------------------------------------------------

# 1. Dump the database
DUMP_FILE="$TEMP_DIR/internops_${TIMESTAMP}.dump"
DUMP_START=$(date +%s)

log "Dumping database to $DUMP_FILE ..."
if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump --no-owner --no-privileges --format=custom \
    "$DATABASE_URL" -f "$DUMP_FILE" 2>&1 | tee -a "$LOG_FILE"
else
  PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-privileges --format=custom \
    -f "$DUMP_FILE" 2>&1 | tee -a "$LOG_FILE"
fi

DUMP_END=$(date +%s)
DUMP_SIZE=$(stat -f%z "$DUMP_FILE" 2>/dev/null || stat --printf='%s' "$DUMP_FILE" 2>/dev/null || echo "unknown")
DUMP_DURATION=$(( DUMP_END - DUMP_START ))
log "Dump complete. Size: ${DUMP_SIZE} bytes. Duration: ${DUMP_DURATION}s."

# 2. Encrypt the dump with GPG
ENCRYPTED_FILE="${DUMP_FILE}.gpg"
log "Encrypting dump with GPG ..."

if [[ -f "$GPG_PASSPHRASE_FILE" ]]; then
  gpg --batch --yes --passphrase-file "$GPG_PASSPHRASE_FILE" \
      --symmetric --cipher-algo AES256 \
      --output "$ENCRYPTED_FILE" "$DUMP_FILE"
else
  echo "WARNING: No GPG passphrase file found. Using interactive encryption."
  gpg --symmetric --cipher-algo AES256 \
      --output "$ENCRYPTED_FILE" "$DUMP_FILE"
fi

ENCRYPTED_SIZE=$(stat -f%z "$ENCRYPTED_FILE" 2>/dev/null || stat --printf='%s' "$ENCRYPTED_FILE" 2>/dev/null || echo "unknown")
log "Encryption complete. Encrypted size: ${ENCRYPTED_SIZE} bytes."

# Remove the plaintext dump immediately
rm -f "$DUMP_FILE"
log "Plaintext dump removed."

# 3. Upload to S3
if [[ "$NO_UPLOAD" == false ]]; then
  REMOTE_PATH="$S3_BUCKET/backups/internops_${TIMESTAMP}.dump.gpg"
  log "Uploading encrypted backup to $REMOTE_PATH ..."

  aws s3 cp "$ENCRYPTED_FILE" "$REMOTE_PATH" \
    --region "$AWS_REGION" \
    --storage-class STANDARD_IA \
    --quiet 2>&1 | tee -a "$LOG_FILE"

  log "Upload complete."
else
  log "Skipping S3 upload (--no-upload flag)."
  log "Encrypted backup saved locally: $ENCRYPTED_FILE"
fi

# 4. Rotation / Retention Policy
if [[ "$NO_UPLOAD" == false ]]; then
  log "Applying retention policy: removing backups older than ${RETENTION_DAYS} days ..."

  CUTOFF_DATE=$(date -u -d "${RETENTION_DAYS} days ago" +%Y-%m-%d 2>/dev/null || \
                date -u -v-${RETENTION_DAYS}d +%Y-%m-%d 2>/dev/null || echo "")

  if [[ -n "$CUTOFF_DATE" ]]; then
    # List all backups and filter by date
    aws s3 ls "$S3_BUCKET/backups/" --recursive --region "$AWS_REGION" 2>/dev/null | \
    while read -r line; do
      # Each line: "2026-01-15 12:34:56   12345 backups/internops_20260115T123456Z.dump.gpg"
      FILE_DATE=$(echo "$line" | awk '{print $1}')
      FILE_KEY=$(echo "$line" | awk '{print $4}')

      if [[ -n "$FILE_DATE" && -n "$FILE_KEY" && "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
        log "Removing expired backup: $FILE_KEY (date: $FILE_DATE)"
        aws s3 rm "$S3_BUCKET/$FILE_KEY" --region "$AWS_REGION" --quiet 2>/dev/null || true
      fi
    done
    log "Retention policy applied."
  else
    log "WARNING: Could not compute retention date. Skipping rotation."
  fi
fi

# 5. Clean up local temp files (keep encrypted copy if --no-upload)
if [[ "$NO_UPLOAD" == false ]]; then
  rm -f "$ENCRYPTED_FILE"
  log "Local encrypted copy removed."
fi

# 6. Send notification (optional)
if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"text\": \"[InternOps] Backup completed successfully at ${TIMESTAMP}\"}" \
    &>/dev/null || log "WARNING: Slack notification failed."
fi

log "===== Backup Complete ====="
