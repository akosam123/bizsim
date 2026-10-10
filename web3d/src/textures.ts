// Procedural canvas textures: signs, awnings, floors, facades, the menu board.
import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function tex(c: HTMLCanvasElement, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

const DISPLAY = '"Bricolage Grotesque", "Arial Black", system-ui, sans-serif';

/** A painted shop sign. */
export function signTexture(text: string, bg: string, fg: string, opts: { sub?: string; w?: number; h?: number } = {}) {
  const w = opts.w ?? 1024, h = opts.h ?? 192;
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 8;
  g.strokeRect(12, 12, w - 24, h - 24);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = opts.sub ? h * 0.42 : h * 0.52;
  g.font = `800 ${size}px ${DISPLAY}`;
  while (g.measureText(text).width > w * 0.9 && size > 20) {
    size -= 4;
    g.font = `800 ${size}px ${DISPLAY}`;
  }
  g.fillText(text, w / 2, opts.sub ? h * 0.42 : h * 0.53);
  if (opts.sub) {
    g.globalAlpha = 0.8;
    g.font = `600 ${h * 0.17}px ${DISPLAY}`;
    g.fillText(opts.sub.toUpperCase().split('').join(' '), w / 2, h * 0.78);
  }
  return tex(c);
}

export function stripeTexture(a: string, b: string, stripes = 8) {
  const [c, g] = canvas(256, 64);
  const sw = 256 / stripes;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 ? b : a;
    g.fillRect(i * sw, 0, sw, 64);
  }
  // scalloped shadow at the bottom edge
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 52, 256, 12);
  return tex(c);
}

export function tileTexture(a: string, b: string, n = 8, repeat: [number, number] = [1, 1]) {
  const [c, g] = canvas(256, 256);
  const s = 256 / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = (i + j) % 2 ? a : b;
      g.fillRect(i * s, j * s, s, s);
    }
  }
  g.strokeStyle = 'rgba(0,0,0,0.08)';
  g.lineWidth = 2;
  for (let k = 0; k <= n; k++) {
    g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s, 256); g.stroke();
    g.beginPath(); g.moveTo(0, k * s); g.lineTo(256, k * s); g.stroke();
  }
  return tex(c, repeat);
}

export function planksTexture(base: string, repeat: [number, number] = [1, 1]) {
  const [c, g] = canvas(256, 256);
  const col = new THREE.Color(base);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const shade = 0.85 + ((r * 37) % 7) / 30;
    g.fillStyle = `#${col.clone().multiplyScalar(shade).getHexString()}`;
    g.fillRect(0, r * 32, 256, 32);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, r * 32 + 30, 256, 2);
    const off = ((r * 97) % 4) * 64;
    g.fillRect(off, r * 32, 2, 32);
    g.fillRect((off + 128) % 256, r * 32, 2, 32);
    // grain
    g.strokeStyle = 'rgba(0,0,0,0.05)';
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      const y = r * 32 + 5 + k * 7;
      g.moveTo(0, y);
      g.bezierCurveTo(80, y + 3, 170, y - 3, 256, y + 1);
      g.stroke();
    }
  }
  return tex(c, repeat);
}

export function noiseTexture(base: string, amount = 18, repeat: [number, number] = [1, 1], lines?: { every: number; color: string }) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  if (lines) {
    g.fillStyle = lines.color;
    for (let k = 0; k < 256; k += lines.every) g.fillRect(0, k, 256, 2);
  }
  return tex(c, repeat);
}

/** Brick facade with a mortar grid. */
export function brickTexture(base: string, repeat: [number, number]) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#d8d0c4';
  g.fillRect(0, 0, 256, 256);
  const col = new THREE.Color(base);
  const bh = 16, bw = 48;
  for (let r = 0; r < 256 / bh; r++) {
    const off = (r % 2) * (bw / 2);
    for (let x = -bw; x < 256 + bw; x += bw) {
      const k = 0.86 + (((r * 13 + x * 7) % 11) / 11) * 0.22;
      g.fillStyle = `#${col.clone().multiplyScalar(k).getHexString()}`;
      g.fillRect(x + off + 1.5, r * bh + 1.5, bw - 3, bh - 3);
    }
  }
  return tex(c, repeat);
}

/** Menu board drawn from the real menu. */
export function menuBoardTexture(heading: string, lines: { name: string; price: string; isNew: boolean }[], note: string, accent: string) {
  const w = 1024, h = 512;
  const [c, g] = canvas(w, h);
  g.fillStyle = '#1f2522';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#8a6b45';
  g.lineWidth = 22;
  g.strokeRect(0, 0, w, h);
  g.fillStyle = accent;
  g.font = `800 58px ${DISPLAY}`;
  g.textAlign = 'center';
  g.fillText(heading.toUpperCase(), w / 2, 86);
  g.font = `500 30px ${DISPLAY}`;
  g.textAlign = 'left';
  const rows = lines.slice(0, 8);
  const cols = rows.length > 4 ? 2 : 1;
  const colW = (w - 120) / cols;
  rows.forEach((l, i) => {
    const col = cols === 2 ? Math.floor(i / Math.ceil(rows.length / 2)) : 0;
    const row = cols === 2 ? i % Math.ceil(rows.length / 2) : i;
    const x = 60 + col * colW;
    const y = 160 + row * 64;
    g.fillStyle = '#f2efe6';
    g.fillText(l.name + (l.isNew ? ' ★' : ''), x, y);
    g.textAlign = 'right';
    g.fillStyle = accent;
    g.fillText(l.price, x + colW - 30, y);
    g.textAlign = 'left';
    g.fillStyle = 'rgba(242,239,230,0.25)';
    g.fillRect(x, y + 14, colW - 30, 2);
  });
  g.fillStyle = 'rgba(242,239,230,0.6)';
  g.font = `italic 500 26px ${DISPLAY}`;
  g.textAlign = 'center';
  g.fillText(note, w / 2, h - 36);
  return tex(c);
}

/** Simple poster / paper sign (e.g. FOR LEASE). */
export function paperTexture(text: string, sub: string) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#f4efe1';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#b23a2e';
  g.textAlign = 'center';
  g.font = `800 52px ${DISPLAY}`;
  g.fillText(text, 128, 110);
  g.fillStyle = '#333';
  g.font = `600 22px ${DISPLAY}`;
  g.fillText(sub, 128, 160);
  return tex(c);
}

/** Sky dome: gradient, sun disc and glow, drifting fbm clouds. */
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#6fa8dc') },
      bottom: { value: new THREE.Color('#dfeaf0') },
      sunColor: { value: new THREE.Color('#fff2d8') },
      sunDir: { value: new THREE.Vector3(0.3, 0.6, 0.5).normalize() },
      cloudColor: { value: new THREE.Color('#ffffff') },
      cloudShade: { value: new THREE.Color('#b9c4d0') },
      time: { value: 0 },
      cover: { value: 0.45 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 bottom; uniform vec3 sunColor; uniform vec3 sunDir;
      uniform vec3 cloudColor; uniform vec3 cloudShade; uniform float time; uniform float cover;
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(bottom, top, pow(clamp(h*1.25+0.05, 0.0, 1.0), 0.7));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(sd, 6.0)*0.35 + pow(sd, 64.0)*0.6);
        col = mix(col, sunColor*1.6, smoothstep(0.9993, 0.9997, sd));
        if (d.y > 0.02) {
          vec2 uv = d.xz / (d.y + 0.12) * 1.4 + vec2(time*0.004, time*0.0015);
          float n = fbm(uv);
          float c = smoothstep(1.0 - cover, 1.0 - cover + 0.32, n);
          float shade = fbm(uv + 0.6);
          vec3 cc = mix(cloudColor, cloudShade, smoothstep(0.35, 0.8, shade));
          cc += sunColor * pow(sd, 8.0) * 0.4;
          col = mix(col, cc, c * smoothstep(0.02, 0.25, d.y) * 0.92);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------- PBR surfaces with normal maps ----------------
export interface Surface { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap?: THREE.Texture }

function seededRand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function normalFrom(height: Uint8ClampedArray | Float32Array, w: number, h: number, strength: number) {
  const [c, g] = canvas(w, h);
  const img = g.createImageData(w, h);
  const H = (x: number, y: number) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
    const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * w + x) * 4;
    img.data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
    img.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255;
    img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Paint color and height together, then derive the normal map. */
function surface(size: number, seed: number, strength: number, paint: (ctx: { put: (x: number, y: number, rgb: [number, number, number], ht: number) => void; rand: () => number; size: number }) => void): Surface {
  const [c, g] = canvas(size, size);
  const img = g.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rand = seededRand(seed);
  paint({
    rand, size,
    put: (x, y, rgb, ht) => {
      const i = y * size + x;
      img.data[i * 4] = rgb[0]; img.data[i * 4 + 1] = rgb[1]; img.data[i * 4 + 2] = rgb[2]; img.data[i * 4 + 3] = 255;
      height[i] = ht;
    },
  });
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  return { map, normalMap: normalFrom(height, size, size, strength) };
}

const rgbOf = (hex: string) => { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255] as [number, number, number]; };
const clamp255 = (v: number) => Math.max(0, Math.min(255, v));
const jitter = (rgb: [number, number, number], k: number, n: number): [number, number, number] => [clamp255(rgb[0] * k + n), clamp255(rgb[1] * k + n), clamp255(rgb[2] * k + n)];

// value noise for textures
function vnoise(seed: number) {
  const r = seededRand(seed);
  const N = 256, perm = new Float32Array(N * N);
  for (let i = 0; i < perm.length; i++) perm[i] = r();
  const at = (x: number, y: number) => perm[((y & (N - 1)) * N) + (x & (N - 1))];
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
}

const cache = new Map<string, Surface>();
function cached(key: string, make: () => Surface) {
  let s = cache.get(key);
  if (!s) { s = make(); cache.set(key, s); }
  return s;
}

export function bricks(color: string) {
  return cached(`brick${color}`, () => surface(512, 11, 2.2, ({ put, rand, size }) => {
    const base = rgbOf(color);
    const mortar = rgbOf('#cbc3b6');
    const bw = 64, bh = 24, m = 3;
    const shades: number[] = [];
    for (let i = 0; i < 400; i++) shades.push(0.78 + rand() * 0.4);
    const n = vnoise(3);
    for (let y = 0; y < size; y++) {
      const row = Math.floor(y / bh);
      const off = (row % 2) * (bw / 2);
      for (let x = 0; x < size; x++) {
        const bx = Math.floor((x + off) / bw);
        const inX = (x + off) % bw, inY = y % bh;
        const isMortar = inX < m || inY < m;
        const grain = n(x * 0.35, y * 0.35) * 26 - 13;
        if (isMortar) put(x, y, jitter(mortar, 0.92, grain * 0.6), 40 + grain);
        else {
          const k = shades[(row * 13 + bx * 7) % shades.length];
          const edge = Math.min(inX - m, bw - inX, inY - m, bh - inY);
          put(x, y, jitter(base, k, grain), 170 + Math.min(edge, 4) * 12 + grain * 0.8);
        }
      }
    }
  }));
}

export function stoneBlocks(color: string) {
  return cached(`stone${color}`, () => surface(512, 23, 1.6, ({ put, rand, size }) => {
    const base = rgbOf(color);
    const n = vnoise(5);
    const bw = 128, bh = 64;
    const shades: number[] = [];
    for (let i = 0; i < 64; i++) shades.push(0.9 + rand() * 0.16);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const row = Math.floor(y / bh), off = (row % 2) * (bw / 2);
      const inX = (x + off) % bw, inY = y % bh;
      const joint = inX < 3 || inY < 3;
      const g = n(x * 0.08, y * 0.08) * 20 + n(x * 0.6, y * 0.6) * 10 - 15;
      const k = shades[(row * 5 + Math.floor((x + off) / bw)) % shades.length];
      put(x, y, jitter(base, joint ? 0.72 : k, g), joint ? 30 : 180 + g);
    }
  }));
}

export function concreteSlabs(color = '#c9c3b8') {
  return cached(`slab${color}`, () => surface(512, 31, 2.4, ({ put, size }) => {
    const base = rgbOf(color);
    const n = vnoise(7), n2 = vnoise(8);
    const tile = 256;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const jx = x % tile, jy = y % tile;
      const joint = jx < 3 || jy < 3;
      const stain = n(x * 0.012, y * 0.012);
      const speck = n2(x * 0.9, y * 0.9);
      const g = (stain - 0.5) * 22 + (speck - 0.5) * 8;
      put(x, y, jitter(base, joint ? 0.68 : 0.96 + (stain - 0.5) * 0.12, g), joint ? 20 : 150 + speck * 10);
    }
  }));
}

export function asphalt() {
  return cached('asphalt', () => surface(512, 41, 1.6, ({ put, size }) => {
    const base = rgbOf('#3e4146');
    const n = vnoise(9), n2 = vnoise(10), n3 = vnoise(12);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const agg = n2(x * 1.3, y * 1.3);
      const patch = n(x * 0.01, y * 0.01);
      const crack = Math.abs(n3(x * 0.03, y * 0.03) - 0.5) < 0.006 ? 1 : 0;
      const g = (agg - 0.5) * 16 + (patch - 0.5) * 16 - crack * 20;
      put(x, y, jitter(base, 0.95, g), 120 + agg * 35 - crack * 60);
    }
  }));
}

export function planks(color: string) {
  return cached(`planks${color}`, () => surface(512, 51, 1.8, ({ put, rand, size }) => {
    const base = rgbOf(color);
    const n = vnoise(13);
    const ph = 64;
    const tones: number[] = [];
    for (let i = 0; i < 64; i++) tones.push(0.8 + rand() * 0.35);
    for (let y = 0; y < size; y++) {
      const row = Math.floor(y / ph);
      const off = (row * 197) % size;
      for (let x = 0; x < size; x++) {
        const seg = Math.floor(((x + off) % size) / 256);
        const seam = y % ph < 2 || ((x + off) % 256) < 2;
        const grain = Math.sin((y + n(x * 0.02, y * 0.15) * 30) * 0.9) * 0.5 + 0.5;
        const k = tones[(row * 3 + seg) % tones.length] * (0.9 + grain * 0.14);
        put(x, y, jitter(base, seam ? 0.55 : k, (n(x * 0.5, y * 0.5) - 0.5) * 10), seam ? 30 : 160 + grain * 25);
      }
    }
  }));
}

export function tiles(a: string, b: string, n = 8) {
  return cached(`tiles${a}${b}${n}`, () => surface(512, 61, 2.0, ({ put, size }) => {
    const A = rgbOf(a), B = rgbOf(b), grout = rgbOf('#b8b4ac');
    const s = size / n;
    const nz = vnoise(15);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const ix = Math.floor(x / s), iy = Math.floor(y / s);
      const gx = x % s, gy = y % s;
      const g = gx < 2 || gy < 2;
      const col = (ix + iy) % 2 ? A : B;
      const v = (nz(x * 0.2, y * 0.2) - 0.5) * 10;
      put(x, y, g ? jitter(grout, 0.9, v) : jitter(col, 1, v), g ? 40 : 200 + v);
    }
  }));
}

export function grass() {
  return cached('grass', () => surface(512, 71, 1.4, ({ put, size }) => {
    const n = vnoise(17), n2 = vnoise(18), n3 = vnoise(19);
    const a = rgbOf('#6d8f4a'), b = rgbOf('#8aa85c'), d = rgbOf('#5b7a3c');
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const big = n(x * 0.015, y * 0.015);
      const blade = n2(x * 1.6, y * 0.5);
      const fine = n3(x * 3, y * 3);
      const col: [number, number, number] = [0, 1, 2].map((k) => a[k] * (1 - big) + b[k] * big) as [number, number, number];
      const mixd = blade > 0.7 ? d : col;
      put(x, y, jitter(mixd, 0.9 + fine * 0.2, 0), 100 + blade * 100 + fine * 30);
    }
  }));
}

export function plaster(color: string) {
  return cached(`plaster${color}`, () => surface(256, 81, 1.0, ({ put, size }) => {
    const base = rgbOf(color);
    const n = vnoise(21), n2 = vnoise(22);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = n(x * 0.05, y * 0.05) * 0.6 + n2(x * 0.5, y * 0.5) * 0.4;
      put(x, y, jitter(base, 0.95 + v * 0.08, 0), 120 + v * 60);
    }
  }));
}

export function carpet(color: string) {
  return cached(`carpet${color}`, () => surface(256, 91, 0.8, ({ put, size }) => {
    const base = rgbOf(color);
    const n = vnoise(25);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = n(x * 1.5, y * 1.5);
      put(x, y, jitter(base, 0.9 + v * 0.2, 0), 120 + v * 80);
    }
  }));
}

/** Material from a surface with its own repeat. */
export function pbr(s: Surface, repeat: [number, number], opts: { rough?: number; metal?: number; normal?: number; color?: string } = {}) {
  const map = s.map.clone();
  const nm = s.normalMap.clone();
  for (const t of [map, nm]) { t.repeat.set(repeat[0], repeat[1]); t.needsUpdate = true; }
  const m = new THREE.MeshStandardMaterial({
    color: opts.color ?? '#ffffff', map, normalMap: nm, roughness: opts.rough ?? 0.9, metalness: opts.metal ?? 0,
  });
  m.normalScale.set(opts.normal ?? 1, opts.normal ?? 1);
  return m;
}
