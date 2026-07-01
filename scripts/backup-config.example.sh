#!/usr/bin/env bash
# ==============================================================================
# Backup Configuration Template
# Copy this file to backup-config.sh and fill in your values.
# ==============================================================================

# --- Database Connection ------------------------------------------------------
# For local Docker PostgreSQL:
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="internops"
DB_USER="internops"

# Or use a full connection string (overrides the above):
# DATABASE_URL="postgresql://internops:internops123@localhost:5432/internops"

# --- GPG Encryption -----------------------------------------------------------
# Path to the GPG passphrase file (one line, no newline at end).
# Generate with:  echo -n 'YOUR_STRONG_PASSPHRASE' > scripts/backup.key
# Protect with:   chmod 600 scripts/backup.key
GPG_PASSPHRASE_FILE="./scripts/backup.key"

# GPG recipient for asymmetric encryption (leave empty for symmetric/c passphrase).
# GPG_RECIPIENT="backup@internops.com"

# --- Cloud Storage (AWS S3) ---------------------------------------------------
# Bucket name (must already exist with encryption enabled).
S3_BUCKET="s3://internops-backups"

# AWS region
AWS_REGION="us-east-1"

# --- Retention / Rotation -----------------------------------------------------
# Number of days to keep backups before automatic deletion.
RETENTION_DAYS=30

# --- Notifications (optional) -------------------------------------------------
# Slack or email webhook for backup success/failure alerts.
# SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# --- Paths --------------------------------------------------------------------
# Temporary directory for dumps during backup process.
TEMP_DIR="/tmp/internops-backup"

# Log file location.
LOG_DIR="./logs"
