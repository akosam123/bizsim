// Grid navigation: a walkability grid built from the same boxes that block
// the player, plus A* with line-of-sight smoothing so paths look natural.

export interface Box { x0: number; z0: number; x1: number; z1: number }
export interface P2 { x: number; z: number }

export class NavGrid {
  readonly cell: number;
  readonly minX: number;
  readonly minZ: number;
  readonly w: number;
  readonly h: number;
  readonly blocked: Uint8Array;
  /** connected-area id per free cell (0 = blocked); filled by labelAreas() */
  area: Int32Array | null = null;

  constructor(minX: number, minZ: number, maxX: number, maxZ: number, cell = 0.3) {
    this.cell = cell;
    this.minX = minX;
    this.minZ = minZ;
    this.w = Math.ceil((maxX - minX) / cell);
    this.h = Math.ceil((maxZ - minZ) / cell);
    this.blocked = new Uint8Array(this.w * this.h);
  }

  addBox(b: Box, pad: number) {
    const x0 = b.x0 - pad, x1 = b.x1 + pad, z0 = b.z0 - pad, z1 = b.z1 + pad;
    const i0 = Math.max(0, Math.floor((x0 - this.minX) / this.cell));
    const i1 = Math.min(this.w - 1, Math.ceil((x1 - this.minX) / this.cell));
    const j0 = Math.max(0, Math.floor((z0 - this.minZ) / this.cell));
    const j1 = Math.min(this.h - 1, Math.ceil((z1 - this.minZ) / this.cell));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cx = this.minX + (i + 0.5) * this.cell;
        const cz = this.minZ + (j + 0.5) * this.cell;
        if (cx > x0 && cx < x1 && cz > z0 && cz < z1) this.blocked[j * this.w + i] = 1;
      }
    }
  }

  /** Flood-fill the free cells into connected areas, so we never search for a
   * route to somewhere you can't reach (behind buildings, inside a fence). */
  labelAreas() {
    const W = this.w, H = this.h;
    const area = new Int32Array(W * H);
    const stack = new Int32Array(W * H);
    let id = 0;
    for (let start = 0; start < W * H; start++) {
      if (this.blocked[start] || area[start]) continue;
      id++;
      let top = 0;
      stack[top++] = start;
      area[start] = id;
      while (top) {
        const c = stack[--top];
        const i = c % W, j = (c / W) | 0;
        if (i > 0 && !this.blocked[c - 1] && !area[c - 1]) { area[c - 1] = id; stack[top++] = c - 1; }
        if (i < W - 1 && !this.blocked[c + 1] && !area[c + 1]) { area[c + 1] = id; stack[top++] = c + 1; }
        if (j > 0 && !this.blocked[c - W] && !area[c - W]) { area[c - W] = id; stack[top++] = c - W; }
        if (j < H - 1 && !this.blocked[c + W] && !area[c + W]) { area[c + W] = id; stack[top++] = c + W; }
      }
    }
    this.area = area;
  }

  areaAt(i: number, j: number) {
    return this.area && i >= 0 && j >= 0 && i < this.w && j < this.h ? this.area[j * this.w + i] : 0;
  }

  ci(x: number) { return Math.floor((x - this.minX) / this.cell); }
  cj(z: number) { return Math.floor((z - this.minZ) / this.cell); }
  wx(i: number) { return this.minX + (i + 0.5) * this.cell; }
  wz(j: number) { return this.minZ + (j + 0.5) * this.cell; }

  freeCell(i: number, j: number) {
    return i >= 0 && j >= 0 && i < this.w && j < this.h && !this.blocked[j * this.w + i];
  }
  isFree(x: number, z: number) { return this.freeCell(this.ci(x), this.cj(z)); }

  /** Closest free cell; with `area`, only cells you can actually reach from there. */
  nearestFree(x: number, z: number, area = 0): [number, number] | null {
    const i0 = this.ci(x), j0 = this.cj(z);
    const ok = (i: number, j: number) => this.freeCell(i, j) && (!area || this.areaAt(i, j) === area);
    if (ok(i0, j0)) return [i0, j0];
    for (let r = 1; r < 70; r++) {
      let best: [number, number] | null = null;
      let bestD = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = i0 + di, j = j0 + dj;
          if (!ok(i, j)) continue;
          const d = di * di + dj * dj;
          if (d < bestD) { bestD = d; best = [i, j]; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Straight line walkable? Samples at a fraction of a cell. */
  lineFree(ax: number, az: number, bx: number, bz: number) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / (this.cell * 0.4)));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      if (!this.isFree(ax + dx * t, az + dz * t)) return false;
    }
    return true;
  }

  findPath(sx: number, sz: number, tx: number, tz: number): P2[] | null {
    const s = this.nearestFree(sx, sz);
    if (!s) return null;
    // aim for the nearest point in the same connected area as the start
    const reach = this.areaAt(s[0], s[1]);
    const t = this.nearestFree(tx, tz, reach);
    if (!t) return null;
    const W = this.w, N = this.w * this.h;
    const start = s[1] * W + s[0], goal = t[1] * W + t[0];
    const endX = this.wx(t[0]), endZ = this.wz(t[1]);
    const exactEnd = this.isFree(tx, tz) && (!reach || this.areaAt(this.ci(tx), this.cj(tz)) === reach);
    if (start === goal) return [{ x: exactEnd ? tx : endX, z: exactEnd ? tz : endZ }];

    const g = new Float32Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap: number[] = [];
    const f = new Float32Array(N);
    const push = (n: number) => {
      heap.push(n);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (f[heap[p]] <= f[heap[k]]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1, r = l + 1;
          let m = k;
          if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
          if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };
    const hx = t[0], hz = t[1];
    const heur = (i: number, j: number) => {
      const dx = Math.abs(i - hx), dz = Math.abs(j - hz);
      return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };
    g[start] = 0;
    f[start] = heur(s[0], s[1]);
    push(start);
    let found = false;
    let guard = 0;
    while (heap.length && guard++ < 400000) {
      const cur = pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % W, cj = (cur / W) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (!this.freeCell(ni, nj)) continue;
          // no corner cutting
          if (di && dj && (!this.freeCell(ci + di, cj) || !this.freeCell(ci, cj + dj))) continue;
          const n = nj * W + ni;
          if (closed[n]) continue;
          const ng = g[cur] + (di && dj ? Math.SQRT2 : 1);
          if (ng < g[n]) {
            g[n] = ng;
            from[n] = cur;
            f[n] = ng + heur(ni, nj);
            push(n);
          }
        }
      }
    }
    if (!found) return null;
    const raw: P2[] = [];
    for (let n = goal; n !== -1; n = from[n]) raw.push({ x: this.wx(n % W), z: this.wz((n / W) | 0) });
    raw.reverse();
    raw[raw.length - 1] = { x: exactEnd ? tx : endX, z: exactEnd ? tz : endZ };
    // string-pull: keep only the waypoints we can't see past
    const out: P2[] = [];
    let anchor = { x: sx, z: sz };
    let k = 0;
    while (k < raw.length) {
      let far = k;
      for (let m = raw.length - 1; m > k; m--) {
        if (this.lineFree(anchor.x, anchor.z, raw[m].x, raw[m].z)) { far = m; break; }
      }
      out.push(raw[far]);
      anchor = raw[far];
      k = far + 1;
    }
    return out;
  }
}

/** Push a circle out of any boxes it overlaps. Mutates p. */
export function collide(p: P2, r: number, boxes: Box[]) {
  for (const b of boxes) {
    const cx = Math.max(b.x0, Math.min(p.x, b.x1));
    const cz = Math.max(b.z0, Math.min(p.z, b.z1));
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r;
      p.z = cz + (dz / d) * r;
    } else {
      // centre is inside the box: leave by the nearest face
      const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z;
      const m = Math.min(l, rr, t, bt);
      if (m === l) p.x = b.x0 - r;
      else if (m === rr) p.x = b.x1 + r;
      else if (m === t) p.z = b.z0 - r;
      else p.z = b.z1 + r;
    }
  }
}
