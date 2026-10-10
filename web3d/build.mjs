// Bundles the 3D front end + the shared game engine into one artifact page.
// three.js loads from jsDelivr at a pinned version; everything else is inline.
import { build } from '/opt/npm-tools/node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
mkdirSync(join(here, 'dist'), { recursive: true });

const res = await build({
  entryPoints: [join(here, 'src/main.ts')],
  bundle: true,
  format: 'esm',
  minify: process.argv.includes('--dev') ? false : true,
  external: ['three'],
  target: 'es2020',
  write: false,
  charset: 'utf8',
  logLevel: 'warning',
});
let js = res.outputFiles[0].text;
js = js.replace(/from\s*["']three["']/g, `from "${THREE_URL}"`).replace(/<\/script/gi, '<\\/script');
// If the module (or three.js from the CDN) never runs, say so instead of
// leaving "Building the street…" up forever.
const failSafe = `<script>
(function () {
  var mod = document.currentScript && document.currentScript.previousElementSibling;
  window.__bizsimFail = function (msg) {
    var l = document.getElementById('loading');
    if (!l || window.__bizsimFailed) return;
    window.__bizsimFailed = true;
    l.hidden = false;
    l.innerHTML = '<div class="fail" role="alert"><b>The 3D game couldn\u2019t start.</b><span>' + (msg || 'Part of it didn\u2019t download. Check your connection and reload.') + '</span><button type="button" class="primary" id="failReload">Reload</button></div>';
    var b = document.getElementById('failReload');
    if (b) b.onclick = function () { location.reload(); };
  };
  if (mod) mod.addEventListener('error', function () { window.__bizsimFail(); });
  setTimeout(function () { if (!window.__bizsimBooted) window.__bizsimFail(); }, 25000);
})();
</script>`;
const page = readFileSync(join(here, 'template.html'), 'utf8') + `\n<script type="module">\n${js}\n</script>\n${failSafe}\n`;
writeFileSync(join(here, 'dist/bizsim3d.html'), page);
// local test wrapper (mimics the artifact skeleton)
writeFileSync(join(here, 'dist/test.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0;font:14px system-ui}</style></head><body>${page}</body></html>`);
console.log(`built ${(page.length / 1024).toFixed(0)} KB`);
