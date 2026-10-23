#!/usr/bin/env bash
# Copia i giochi dalle loro cartelle di lavoro in questo repository, pronti per GitHub Pages.
# I giochi si modificano nelle loro cartelle (../emissary, ../syndicate, ...), mai qui:
# qui c'è solo la copia da pubblicare, che questo script riscrive ogni volta.
# Ogni pagina chiede ai motori di ricerca di non indicizzarla: è una prova non annunciata.
set -euo pipefail
cd "$(dirname "$0")"

GIOCHI=(emissary syndicate boba-tea)
FILE=(index.html app.js demo.js engine.js style.css)

for g in "${GIOCHI[@]}"; do
  rm -rf "$g"
  mkdir -p "$g"
  for f in "${FILE[@]}"; do
    cp "../$g/$f" "$g/$f"
  done
  if ! grep -q 'name="robots"' "$g/index.html"; then
    sed -i 's#<head>#<head>\n  <meta name="robots" content="noindex, nofollow">#' "$g/index.html"
  fi
  echo "copiato: $g"
done
