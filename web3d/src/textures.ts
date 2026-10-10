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

/** Vertical gradient for the sky dome. */
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#6fa8dc') },
      bottom: { value: new THREE.Color('#dfeaf0') },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.8)),1.0);
 #include <colorspace_fragment>
 }`,
  });
}
