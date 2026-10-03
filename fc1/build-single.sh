#!/bin/sh
# Bundles FC1 into one self-contained HTML file (CSS and all scripts inlined).
cd "$(dirname "$0")"
out=FC1.html
{
  echo '<!doctype html>'
  echo '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<title>FC1</title>'
  echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap">'
  echo '<style>'; cat styles.css; echo '</style></head><body>'
  awk '/<div id="app">/{on=1} on{print} on && /^<\/div>/{on=0}' index.html
  for f in data.js engine.js audio.js sprites.js controls.js arcade.js world.js cutscene.js app.js; do
    echo "<script>/* ===== $f ===== */"; cat "$f"; echo '</script>'
  done
  echo '</body></html>'
} > "$out"
echo "wrote $out ($(wc -c < "$out") bytes)"
