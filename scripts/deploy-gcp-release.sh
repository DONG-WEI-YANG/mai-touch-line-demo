#!/usr/bin/env bash
# Run on the existing GCP VM as root. No initialization, credentials, or cloud provisioning.
set -euo pipefail
[[ $# -ge 2 && $# -le 3 ]] || { echo 'Usage: deploy-gcp-release.sh /tmp/mai-touch-CANDIDATE RELEASE_ID [--schema-rollback-reviewed]' >&2; exit 2; }
[[ $EUID -eq 0 ]] || { echo 'Run via sudo on the existing VM' >&2; exit 2; }
candidate=$(realpath -e -- "$1")
release_id=$2
[[ "$candidate" == /tmp/mai-touch-* && "$release_id" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,70}$ ]] || exit 2
[[ ${3:-} == '' || ${3:-} == --schema-rollback-reviewed ]] || exit 2
exec 9>/run/lock/mai-touch-deploy.lock
flock -n 9 || { echo 'Another deployment is active' >&2; exit 1; }
mountpoint -q /var/data
[[ -s /var/data/mai-touch.db ]]
previous=$(readlink -f /opt/mai-touch/current)
[[ "$previous" == /opt/mai-touch/releases/* && -d "$previous/node_modules" ]]
release=/opt/mai-touch/releases/$release_id
[[ ! -e "$release" ]]
[[ -z $(find "$candidate" -type l -print -quit) ]] || { echo 'Symlink in candidate refused' >&2; exit 1; }
for name in server.js snapshot.js package.json SHA256SUMS; do [[ -s "$candidate/$name" ]]; done
[[ -d "$candidate/migrations/sqlite" ]]
# Accept only builder-generated safe relative manifest paths.
while IFS= read -r line; do
 [[ "$line" =~ ^[a-f0-9]{64}\ \ [a-zA-Z0-9_./-]+$ ]] || exit 1
 file=${line:66}
 [[ "$file" != /* && "$file" != *..* ]] || exit 1
done < "$candidate/SHA256SUMS"
(cd "$candidate" && sha256sum --strict -c SHA256SUMS >/dev/null)
# Every copied file must be checksummed; no unlisted migrations can enter the release.
diff -u <(cd "$candidate" && find server.js snapshot.js package.json migrations -type f | LC_ALL=C sort) <(cut -c67- "$candidate/SHA256SUMS" | LC_ALL=C sort)
cmp -s "$candidate/package.json" "$previous/package.json" || { echo 'Dependency manifest changed. Prepare and verify Linux dependencies separately; refusing reuse.' >&2; exit 1; }
if ! diff -qr "$candidate/migrations" "$previous/migrations" >/dev/null; then
 [[ ${3:-} == --schema-rollback-reviewed ]] || { echo 'Migrations changed. Review old-code compatibility before opting into schema rollback flag.' >&2; exit 1; }
fi
backup_dir=/var/data/backups/pre-$release_id
[[ ! -e "$backup_dir" ]]
install -d -o maitouch -g maitouch -m 700 "$backup_dir"
snapshot=$(cd "$previous" && runuser -u maitouch -- node snapshot.js backup /var/data/mai-touch.db "$backup_dir")
[[ "$snapshot" == "$backup_dir/"*.db && -s "$snapshot" ]]
(cd "$previous" && runuser -u maitouch -- node snapshot.js verify "$snapshot")
install -d -o maitouch -g maitouch -m 750 "$release"
for name in server.js snapshot.js package.json SHA256SUMS; do install -o maitouch -g maitouch -m 640 "$candidate/$name" "$release/$name"; done
cp -a "$candidate/migrations" "$release/migrations"
chown -R maitouch:maitouch "$release/migrations"
ln -s "$previous/node_modules" "$release/node_modules"
# Preserve previous directory while its dependency tree is shared.
switched=0
rollback() {
 local result=$?
 trap - EXIT
 if [[ $result -ne 0 && $switched -eq 1 ]]; then
  ln -s "$previous" "/opt/mai-touch/rollback-$release_id"
  mv -Tf "/opt/mai-touch/rollback-$release_id" /opt/mai-touch/current
  systemctl restart mai-touch || true
  echo "Release failed; previous CODE restored. Database not overwritten. Verify schema compatibility and health. Snapshot: $snapshot" >&2
 fi
 exit "$result"
}
trap rollback EXIT
ln -s "$release" "/opt/mai-touch/current-$release_id"
mv -Tf "/opt/mai-touch/current-$release_id" /opt/mai-touch/current
switched=1
systemctl restart mai-touch
for attempt in $(seq 1 20); do
 if systemctl is-active --quiet mai-touch && curl -fsS --max-time 3 http://127.0.0.1:3000/health | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{const h=JSON.parse(s);process.exit(h.db==="ok"&&h.line==="ready"?0:1)}catch{process.exit(1)}})'; then
  mountpoint -q /var/data
  (cd "$release" && sha256sum --strict -c SHA256SUMS >/dev/null)
  echo "Release healthy: $release_id. Pre-release snapshot: $snapshot"
  switched=0
  exit 0
 fi
 sleep 2
done
echo 'Candidate health failed' >&2
exit 1
