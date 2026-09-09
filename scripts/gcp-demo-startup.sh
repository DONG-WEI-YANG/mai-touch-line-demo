#!/usr/bin/env bash
# GCE metadata startup script. Only initializes the explicitly named data disk.
set -euo pipefail

device=/dev/disk/by-id/google-mai-touch-history-data
mount_dir=/var/data

for attempt in {1..30}; do
  test -b "$device" && break
  sleep 2
done
test -b "$device" || { echo 'Expected history disk is missing' >&2; exit 1; }

fs_type=$(blkid -s TYPE -o value "$device" || true)
if [ -z "$fs_type" ]; then
  # Refuse to format an unknown partitioned, signed, or mounted disk.
  test "$(lsblk -nrpo NAME "$device" | wc -l)" -eq 1
  test -z "$(lsblk -nrpo MOUNTPOINT "$device" | tr -d '[:space:]')"
  test -z "$(wipefs --no-act --noheadings --output TYPE "$device")"
  mkfs.ext4 -L mai-touch-data "$device"
elif [ "$fs_type" != ext4 ]; then
  echo 'History disk has an unexpected filesystem; refusing to change it' >&2
  exit 1
fi

uuid=$(blkid -s UUID -o value "$device")
test -n "$uuid"
mkdir -p "$mount_dir"
if ! awk '$2 == "/var/data" { found=1 } END { exit !found }' /etc/fstab; then
  printf 'UUID=%s /var/data ext4 defaults,nodev,nosuid 0 2\n' "$uuid" >> /etc/fstab
fi
mountpoint -q "$mount_dir" || mount "$mount_dir"
test "$(findmnt -n -o UUID --target "$mount_dir")" = "$uuid"

id maitouch >/dev/null 2>&1 || useradd --system --home-dir /opt/mai-touch --shell /usr/sbin/nologin maitouch
install -d -o maitouch -g maitouch -m 0750 /var/data/backups /opt/mai-touch
chown maitouch:maitouch "$mount_dir"
chmod 0750 "$mount_dir"
echo 'MAI Touch data disk mounted successfully; application not deployed.'
