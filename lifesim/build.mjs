// Bundles the whole game into one self-contained HTML file.
//
//   npm i esbuild && node build.mjs
//
// Writes dist/one-life.html — open it directly, or publish it anywhere.
// Pass --artifact to emit the body-only variant (no doctype/html/head/body),
// which is what the Claude Artifact wrapper expects.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const artifactMode = process.argv.includes('--artifact');

const result = await build({
  entryPoints: [join(here, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020',
  write: false,
});
const js = result.outputFiles[0].text;

const css = readFileSync(join(here, 'css/style.css'), 'utf8');
const html = readFileSync(join(here, 'index.html'), 'utf8');

const body = html
  .slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .trim();

const FONTS = 'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800'
  + '&family=IBM+Plex+Mono:wght@400;500;600'
  + '&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap';

const head = `<title>ONE LIFE</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${FONTS}" />
<style>
${css}
</style>`;

const page = `${head}
${body}
<script>
${js}
</script>`;

const out = artifactMode ? page : `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
${head}
</head>
<body>
${body}
<script>
${js}
</script>
</body>
</html>
`;

mkdirSync(join(here, 'dist'), { recursive: true });
const file = join(here, 'dist', artifactMode ? 'one-life.artifact.html' : 'one-life.html');
writeFileSync(file, out);
console.log(`${file} — ${(out.length / 1024 / 1024).toFixed(2)} MB`);
