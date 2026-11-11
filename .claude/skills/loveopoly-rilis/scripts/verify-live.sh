#!/usr/bin/env bash
# Cocokkan bundle JS yang live di loveopoly.web.app dengan build lokal (dist/), lalu cari teks penanda fitur.
# Pakai: verify-live.sh [teks-penanda]   (jalankan dari akar repo, setelah deploy)
set -euo pipefail
URL="${LIVE_URL:-https://loveopoly.web.app}"
JS=$(curl -fsS "$URL/" | grep -oE 'assets/index-[^"]+\.js' | head -1)
[ -n "$JS" ] || { echo "Tidak menemukan bundle di $URL"; exit 1; }
echo "bundle live: $JS"
if [ -f "dist/$JS" ]; then echo "✓ sama dengan build lokal (dist/)"; else echo "✗ BEDA dengan build lokal: deploy belum sampai atau build lokal lebih baru"; exit 1; fi
if [ $# -gt 0 ]; then
  n=$(curl -fsS "$URL/$JS" | grep -c -- "$1" || true)
  [ "$n" -gt 0 ] && echo "✓ penanda \"$1\" ada di bundle live" || { echo "✗ penanda \"$1\" tidak ada"; exit 1; }
fi
