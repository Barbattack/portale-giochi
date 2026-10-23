#!/usr/bin/env bash
# Costruisce da zero la copia da pubblicare su GitHub Pages: pagina d'ingresso + tredici giochi.
# I giochi si modificano nelle loro cartelle (../emissary, ../syndicate, ...) e nei prototipi di Chiara: mai qui.
# Qui c'è solo la copia, che questo script riscrive ogni volta (si può lanciare quante volte si vuole, il risultato è lo stesso).
#  - Tre giochi con la grafica nuova (emissary, syndicate, boba-tea): si pubblica il prototipo di Chiara così com'è
#    (index, css e js propri, escluse prova/, dorsi.html e note) + engine.js, demo.js, app.js della radice del gioco.
#    I pezzi comuni di design/ (comune.css, pezzi.js, copertina.js, vignette.js, fonts/) vanno in comune/,
#    perché design/ resta fuori da git. I percorsi nella copia sono riscritti qui: i sorgenti non si toccano.
#  - Altri dieci giochi: la versione attuale, cinque file (index.html app.js demo.js engine.js style.css);
#    il-lupo in più copione.js, tutorial.js, pezzi.js, vignette.js (il tutorial a pezzetti sta dentro il gioco).
#  - La pagina d'ingresso è index.html (scritta a mano, non toccata dallo script, solo marcata noindex se serve).
# Ogni pagina chiede ai motori di ricerca di non indicizzarla: è una prova non annunciata.
set -euo pipefail
cd "$(dirname "$0")"

# gioco:cartella-del-prototipo
NUOVI=(
  "emissary:design/prototipi/2026-10-24-emissary"
  "syndicate:design/prototipi/2026-10-23-syndicate"
  "boba-tea:design/prototipi/2026-10-23-boba"
)
ALTRI=(botte-da-fiori il-lupo card-capture sandwich-guy loot-the-loop hide-and-seek dead-center foursquare area-52 skyway)
BASE=(engine.js demo.js app.js)
FILE=(index.html app.js demo.js engine.js style.css)

noindex() {
  if ! grep -q 'name="robots"' "$1"; then
    sed -i 's#<head>#<head>\n  <meta name="robots" content="noindex, nofollow">#' "$1"
  fi
}

# pulizia: via le copie vecchie (anche di giochi usciti dall'elenco)
for g in emissary syndicate boba-tea "${ALTRI[@]}" comune; do rm -rf "$g"; done

# pezzi comuni
mkdir -p comune
for f in comune.css pezzi.js copertina.js vignette.js; do cp "design/$f" "comune/$f"; done
cp -r design/fonts comune/fonts

# tre giochi con la grafica nuova
for voce in "${NUOVI[@]}"; do
  g="${voce%%:*}"; proto="../$g/${voce#*:}"
  mkdir -p "$g"
  for f in "${BASE[@]}"; do cp "../$g/$f" "$g/$f"; done
  for f in "$proto"/*.js "$proto"/*.css "$proto"/index.html; do cp "$f" "$g/"; done
  # percorsi riscritti sulla copia: prima i pezzi comuni, poi la radice del gioco
  sed -i -e 's#\.\./\.\./\.\./\.\./portale-giochi/design/#../comune/#g' -e 's#\.\./\.\./\.\./##g' "$g"/index.html "$g"/*.css "$g"/*.js
  noindex "$g/index.html"
  echo "copiato (grafica nuova): $g"
done

# altri dieci
for g in "${ALTRI[@]}"; do
  mkdir -p "$g"
  for f in "${FILE[@]}"; do cp "../$g/$f" "$g/$f"; done
  # il-lupo ha il tutorial a pezzetti dentro il gioco (24/10/2026): copione dei testi, pezzi e vignette comuni (copie nella radice del gioco), tutorial.js
  if [ "$g" = il-lupo ]; then for f in copione.js tutorial.js pezzi.js vignette.js; do cp "../$g/$f" "$g/$f"; done; fi
  noindex "$g/index.html"
  echo "copiato: $g"
done

noindex index.html
echo "fatto: ingresso + 13 giochi"
