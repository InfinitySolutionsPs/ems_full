#!/bin/sh
set -eu

mkdir -p "${BACKUP_DIR:-/backups}" /config/rclone

# Seed the persisted rclone configuration once. rclone then refreshes its OAuth
# token in the named volume without requiring daily user interaction.
if [ -n "${ONEDRIVE_TOKEN_JSON:-}" ] && ! rclone listremotes --config /config/rclone/rclone.conf 2>/dev/null | grep -qx 'onedrive:'; then
  set -- onedrive onedrive drive_type business token "$ONEDRIVE_TOKEN_JSON"
  [ -z "${ONEDRIVE_CLIENT_ID:-}" ] || set -- "$@" client_id "$ONEDRIVE_CLIENT_ID"
  [ -z "${ONEDRIVE_CLIENT_SECRET:-}" ] || set -- "$@" client_secret "$ONEDRIVE_CLIENT_SECRET"
  rclone --config /config/rclone/rclone.conf config create "$@" >/dev/null
fi

exec python3 /app/backup_service.py
