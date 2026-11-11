#!/usr/bin/env bash
# Status GitHub Actions untuk commit HEAD (atau SHA yang diberikan) lewat API publik (gh CLI tidak terpasang).
# Pakai: ci-status.sh [sha] [--wait]   --wait = ulangi sampai selesai (maks ±25 menit).
# Jalankan --wait di latar belakang (run_in_background) dan tunggu notifikasinya, jangan polling manual.
# API tanpa login dibatasi 60 permintaan/jam per IP: jeda 30 dtk, mundur 2 menit bila kena batas (HTTP 403/429).
# Set GITHUB_TOKEN untuk batas yang jauh lebih longgar.
set -uo pipefail
REPO="${CI_REPO:-arfion11/-Loveopoly}"
SHA=""; WAIT=0
for a in "$@"; do if [ "$a" = "--wait" ]; then WAIT=1; else SHA="$a"; fi; done
[ -n "$SHA" ] || SHA=$(git rev-parse HEAD)
AUTH=(); [ -n "${GITHUB_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN")
for i in $(seq 1 50); do
  BODY=$(curl -sS -w '\n%{http_code}' ${AUTH[@]+"${AUTH[@]}"} "https://api.github.com/repos/$REPO/actions/runs?per_page=1&head_sha=$SHA")
  CODE=$(printf '%s' "$BODY" | tail -n1); JSON=$(printf '%s' "$BODY" | sed '$d')
  if [ "$CODE" != "200" ]; then
    echo "${SHA:0:7} API GitHub HTTP $CODE (kemungkinan batas permintaan), coba lagi nanti"
    [ "$WAIT" = 1 ] || exit 2
    sleep 120; continue
  fi
  R=$(printf '%s' "$JSON" | python3 -c "import sys,json; r=json.load(sys.stdin).get('workflow_runs',[]); print((r[0]['status']+' '+str(r[0]['conclusion'])+' '+r[0]['html_url']) if r else 'belum-ada-run')")
  echo "${SHA:0:7} $R"
  case "$R" in
    "completed success"*) exit 0 ;;
    completed*) exit 1 ;;
  esac
  [ "$WAIT" = 1 ] || exit 0
  sleep 30
done
exit 3
