// Builds the game from web3d/live/ (the Oct 11 version) into web3d/dist/bizsim3d.html.
//   node web3d/build-live.mjs                       (or: npm run build:live)
//   MENTOR_URL=http://localhost:8787 node web3d/build-live.mjs
import { build, transform } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const live = join(here, 'live');
mkdirSync(join(here, 'dist'), { recursive: true });
const dev = process.argv.includes('--dev');

// the game: one file, so it is minified as is (three.js is imported from the CDN inside it)
const game = (await transform(readFileSync(join(live, 'game.js'), 'utf8'), {
  loader: 'js', minify: !dev, target: 'es2020', format: 'esm', logLevel: 'warning',
})).code.replace(/<\/script/gi, '<\\/script');

// the mentor button + panel: its own script, so it can never break the game (see src/overlay.ts)
const overlayBuild = await build({
  entryPoints: [join(here, 'src/overlay.ts')], bundle: true, format: 'iife', minify: !dev,
  target: 'es2020', write: false, charset: 'utf8', logLevel: 'warning',
});
const overlayJs = overlayBuild.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const overlay = `<script>\nwindow.BIZSIM_MENTOR_URL = ${JSON.stringify(process.env.MENTOR_URL || '')};\n${overlayJs}\n</script>`;

const template = readFileSync(join(live, 'template.html'), 'utf8');
const failSafe = readFileSync(join(live, 'failsafe.html'), 'utf8'); // must directly follow the module script
const page = `${template}\n${overlay}\n<script type="module">${game}</script>\n${failSafe}`;
writeFileSync(join(here, 'dist/bizsim3d.html'), page);
writeFileSync(join(here, 'dist/test.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0;font:14px system-ui}</style></head><body>${page}</body></html>`);
console.log(`built ${(page.length / 1024).toFixed(0)} KB -> web3d/dist/bizsim3d.html`);
