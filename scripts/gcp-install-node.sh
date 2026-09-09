#!/usr/bin/env bash
set -euo pipefail

# Verified against nodejs.org/dist/latest-v24.x/SHASUMS256.txt on 2026-09-09.
version=v24.20.0
archive=node-${version}-linux-x64.tar.xz
checksum=2f2c0da162318f0de47665410c7c8c2ed3d36c8f3105de4bbc61176c70a7cbf2
destination=/opt/node-${version}-linux-x64
test "$(uname -m)" = x86_64

if [ ! -x "$destination/bin/node" ]; then
  curl -6 -fsS --retry 2 --max-time 180 "https://nodejs.org/dist/${version}/${archive}" -o "/tmp/${archive}"
  (cd /tmp && printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check -)
  tar -xJf "/tmp/${archive}" -C /opt
fi
for executable in node npm npx; do
  if [ ! -e "/usr/local/bin/$executable" ]; then
    ln -s "$destination/bin/$executable" "/usr/local/bin/$executable"
  fi
done
node --version
npm --version
