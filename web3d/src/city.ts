// The neighbourhood around your shop: Main St and Oak Ave with a signalled
// intersection, City Hall, the apartments, the bank, the gym, a café, the supply
// depot, row houses, a construction site, the market square, a court, a diner.
import * as THREE from 'three';
import type { World } from './world';
import { mat } from './people';
import { CAR_COLORS, CarKind, makeCar } from './cars';
import {
  asphalt, bricks, concreteSlabs, grass, paperTexture, pbr, plaster, signTexture, stoneBlocks, stripeTexture,
} from './textures';

// ---------- world-scaled UV geometry so one material tiles correctly everywhere ----------
export function uvBox(w: number, h: number, d: number, scale: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0] / scale, uv.getY(k) * dims[f][1] / scale);
  }
  return g;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function cachedMat(key: string, make: () => THREE.MeshStandardMaterial) {
  let m = matCache.get(key);
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}
export const M = {
  brick: (c: string) => cachedMat(`b${c}`, () => pbr(bricks(c), [1, 1], { rough: 0.92, normal: 1.2 })),
  stone: (c: string) => cachedMat(`s${c}`, () => pbr(stoneBlocks(c), [1, 1], { rough: 0.85 })),
  plaster: (c: string) => cachedMat(`p${c}`, () => pbr(plaster(c), [1, 1], { rough: 0.95, normal: 0.3 })),
  slab: () => cachedMat('slab', () => pbr(concreteSlabs(), [1, 1], { rough: 0.95 })),
  asphalt: () => cachedMat('asph', () => pbr(asphalt(), [1, 1], { rough: 0.95, normal: 0.8 })),
  grass: () => cachedMat('grass', () => pbr(grass(), [1, 1], { rough: 1, normal: 0.7 })),
  iron: () => mat('#22262a', 0.55, 0.6),
  trim: (c: string) => mat(c, 0.6),
};
// metres covered by one tile of each texture
const S = { brick: 1.75, stone: 3.2, plaster: 2.2, slab: 3.0, asphalt: 7.0, grass: 5.0 };

type Facing = 'N' | 'S' | 'E' | 'W'; // the way the facade looks: S = toward +z
const ROT: Record<Facing, number> = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

export interface BuildingSpec {
  /** centre of the facade on the ground */
  x: number; z: number; facing: Facing;
  width: number; depth: number; floors: number;
  wall: 'brick' | 'stone' | 'plaster';
  color: string;
  trim?: string;
  groundH?: number;
  storefront?: { sign?: THREE.Texture; awning?: string; door?: number; dark?: boolean } | false;
  cornice?: boolean;
  fireEscape?: boolean;
  waterTower?: boolean;
  stoop?: boolean;
  bays?: number;
  label?: string;
}

function local(w: World, x: number, z: number, facing: Facing) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ROT[facing];
  w.scene.add(g);
  return g;
}

/** A street-front building with storefront, window bays, cornice and roof detail. */
export function building(w: World, b: BuildingSpec) {
  const g = local(w, b.x, b.z, b.facing);
  const floorH = 3.1;
  const groundH = b.groundH ?? 4.0;
  const height = groundH + (b.floors - 1) * floorH;
  const wallMat = b.wall === 'brick' ? M.brick(b.color) : b.wall === 'stone' ? M.stone(b.color) : M.plaster(b.color);
  const scale = b.wall === 'brick' ? S.brick : b.wall === 'stone' ? S.stone : S.plaster;
  const trim = M.trim(b.trim ?? '#e9e3d6');
  const body = new THREE.Mesh(uvBox(b.width, height, b.depth, scale), wallMat);
  body.position.set(0, height / 2, -b.depth / 2);
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  // footprint collider in world space
  const c = Math.cos(ROT[b.facing]), s = Math.sin(ROT[b.facing]);
  const corners = [[-b.width / 2, 0], [b.width / 2, 0], [-b.width / 2, -b.depth], [b.width / 2, -b.depth]].map(([lx, lz]) => [b.x + lx * c + lz * s, b.z - lx * s + lz * c]);
  const xs = corners.map((p) => p[0]), zs = corners.map((p) => p[1]);
  w.collider(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs));
  w.mapRects.push({ x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs), kind: 'building', label: b.label });
  w.occluders.push({ x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs), h: height + 0.6 });

  const bays = b.bays ?? Math.max(2, Math.round(b.width / 2.8));
  const bayW = b.width / bays;
  // upper floors
  for (let f = 1; f < b.floors; f++) {
    const y = groundH + (f - 1) * floorH + 0.75;
    for (let i = 0; i < bays; i++) {
      const x = -b.width / 2 + bayW * (i + 0.5);
      const lit = ((i * 7 + f * 3 + Math.round(b.x)) % 5) < 2;
      const ww = Math.min(1.3, bayW * 0.55), wh = 1.65;
      w.box(ww, wh, 0.04, lit ? w.windowLit : w.windowDark, x, y, 0.01, g, false);
      w.box(ww + 0.16, 0.08, 0.1, trim, x, y + wh, 0.04, g, false);
      w.box(ww + 0.22, 0.07, 0.16, trim, x, y - 0.07, 0.06, g, false);
      w.box(0.07, wh, 0.08, trim, x - ww / 2 - 0.03, y, 0.03, g, false);
      w.box(0.07, wh, 0.08, trim, x + ww / 2 + 0.03, y, 0.03, g, false);
      w.box(ww, 0.05, 0.05, trim, x, y + wh * 0.55, 0.03, g, false);
      if (b.wall === 'brick') w.box(ww + 0.3, 0.18, 0.06, M.trim('#cfc5b4'), x, y + wh + 0.08, 0.02, g, false);
    }
    // floor band
    if (b.wall !== 'plaster') w.box(b.width, 0.12, 0.08, trim, 0, groundH + (f - 1) * floorH, 0.03, g, false);
  }
  // cornice with brackets
  if (b.cornice !== false) {
    w.box(b.width + 0.4, 0.32, 0.5, trim, 0, height - 0.32, 0.12, g);
    w.box(b.width + 0.25, 0.14, 0.3, trim, 0, height - 0.5, 0.06, g, false);
    for (let x = -b.width / 2 + 0.3; x <= b.width / 2 - 0.2; x += 0.55) w.box(0.12, 0.2, 0.22, trim, x, height - 0.56, 0.12, g, false);
  }
  // roof: parapet, units, maybe a water tower
  w.box(b.width, 0.6, 0.18, wallMat, 0, height, -0.09, g);
  w.box(b.width, 0.6, 0.18, wallMat, 0, height, -b.depth + 0.09, g);
  w.box(0.18, 0.6, b.depth, wallMat, -b.width / 2 + 0.09, height, -b.depth / 2, g);
  w.box(0.18, 0.6, b.depth, wallMat, b.width / 2 - 0.09, height, -b.depth / 2, g);
  w.box(b.width - 0.3, 0.05, b.depth - 0.3, mat('#5d5a55', 0.95), 0, height, -b.depth / 2, g, false);
  w.box(1.6, 0.9, 1.1, mat('#a7abae', 0.45, 0.5), -b.width / 4, height, -b.depth * 0.6, g);
  if (b.waterTower) {
    const tw = new THREE.Group();
    tw.position.set(b.width / 4, height, -b.depth * 0.5);
    g.add(tw);
    const wood = mat('#6e5038', 0.85);
    for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) w.box(0.12, 2.4, 0.12, M.iron(), lx, 0, lz, tw, false);
    w.cyl(1.25, 1.25, 2.6, wood, 0, 2.4, 0, tw, 18);
    const roofCone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.0, 18), mat('#4a3a2c', 0.8));
    roofCone.position.y = 5.5;
    roofCone.castShadow = true;
    tw.add(roofCone);
  }

  // ground floor
  if (b.storefront !== false) {
    const sf = b.storefront ?? {};
    const glassH = groundH - 1.5;
    w.box(b.width - 0.6, 0.45, 0.14, trim, 0, 0, 0.04, g);
    w.box(b.width - 0.8, glassH, 0.04, sf.dark ? w.windowDark : w.shopGlassOut, 0, 0.45, 0.02, g, false);
    for (let x = -b.width / 2 + 0.3; x <= b.width / 2 - 0.29; x += (b.width - 0.6) / Math.max(2, Math.round(b.width / 2.2))) w.box(0.09, glassH + 0.05, 0.1, trim, x, 0.45, 0.06, g, false);
    w.box(b.width - 0.4, 0.12, 0.14, trim, 0, 0.45 + glassH, 0.06, g, false);
    // sign band
    w.box(b.width - 0.2, 0.9, 0.12, M.trim(b.trim ?? '#2b2a28'), 0, groundH - 0.95, 0.07, g);
    if (sf.sign) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(b.width - 1.2, 8.5), 0.62), new THREE.MeshStandardMaterial({ map: sf.sign, roughness: 0.55, emissive: '#ffffff', emissiveMap: sf.sign, emissiveIntensity: 0 }));
      sign.position.set(0, groundH - 0.5, 0.14);
      g.add(sign);
      w.signMats.push(sign.material as THREE.MeshStandardMaterial);
    }
    if (sf.door !== undefined) {
      w.box(1.3, 2.4, 0.06, mat('#2a2522', 0.5), sf.door, 0.0, 0.05, g, false);
      w.box(1.0, 1.6, 0.02, w.windowDark, sf.door, 0.55, 0.09, g, false);
    }
    if (sf.awning) {
      const awn = new THREE.MeshStandardMaterial({ map: stripeTexture(sf.awning, '#f3efe6', 12), roughness: 0.9, side: THREE.DoubleSide });
      const a = new THREE.Mesh(new THREE.PlaneGeometry(b.width - 1.0, 1.3), awn);
      a.position.set(0, groundH - 1.55, 0.62);
      a.rotation.x = -Math.PI / 2 + 0.55;
      a.castShadow = true;
      g.add(a);
    }
  } else {
    // ground floor of a residential/civic building: windows too
    for (let i = 0; i < bays; i++) {
      const x = -b.width / 2 + bayW * (i + 0.5);
      w.box(Math.min(1.3, bayW * 0.55), 1.6, 0.04, w.windowDark, x, 1.1, 0.01, g, false);
      w.box(Math.min(1.3, bayW * 0.55) + 0.2, 0.07, 0.16, trim, x, 1.03, 0.06, g, false);
    }
  }
  if (b.stoop) {
    const st = M.stone('#b8ad99');
    for (let k = 0; k < 4; k++) w.box(1.8, 0.18 * (k + 1), 0.32, st, 0, 0, 0.16 + (3 - k) * 0.32, g);
    w.box(1.4, 2.5, 0.08, mat('#3a2a20', 0.55), 0, 0.72, 0.02, g, false);
    w.box(0.05, 0.9, 1.3, M.iron(), -0.9, 0.72, 0.7, g, false);
    w.box(0.05, 0.9, 1.3, M.iron(), 0.9, 0.72, 0.7, g, false);
  }
  if (b.fireEscape && b.floors > 2) {
    const iron = M.iron();
    const fx = -b.width / 2 + bayW * 1.0;
    for (let f = 1; f < b.floors; f++) {
      const y = groundH + (f - 1) * floorH - 0.05;
      w.box(bayW * 1.6, 0.06, 1.0, iron, fx, y, 0.55, g, false);
      w.box(bayW * 1.6, 0.04, 0.04, iron, fx, y + 0.95, 1.03, g, false);
      for (let px = -bayW * 0.8; px <= bayW * 0.8; px += 0.35) w.box(0.025, 0.95, 0.025, iron, fx + px, y, 1.03, g, false);
      if (f < b.floors - 1) {
        const stair = w.box(0.6, 0.05, Math.hypot(floorH, bayW * 1.2), iron, fx, y + floorH / 2, 0.55, g, false);
        stair.rotation.set(0, Math.PI / 2, 0);
        stair.rotation.z = Math.atan2(floorH, bayW * 1.2);
        stair.position.y = y + floorH / 2;
      }
    }
  }
  return { group: g, height };
}

export function tree(w: World, x: number, z: number, s = 1, pit = true) {
  const trunk = mat('#5a4332', 0.95);
  w.cyl(0.1 * s, 0.17 * s, 2.6 * s, trunk, x, 0, z, w.scene, 9);
  const br = w.cyl(0.05 * s, 0.08 * s, 1.4 * s, trunk, x + 0.35 * s, 1.9 * s, z, w.scene, 7);
  br.rotation.z = -0.6;
  const br2 = w.cyl(0.05 * s, 0.08 * s, 1.2 * s, trunk, x - 0.3 * s, 2.1 * s, z + 0.2 * s, w.scene, 7);
  br2.rotation.z = 0.7;
  const seed = Math.abs(Math.round(x * 13 + z * 7));
  const crown = new THREE.Group();
  w.scene.add(crown);
  w.crowns.push({ g: crown, x, y: 3.6 * s, z, r: 2.2 * s });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + seed;
    const r = (k === 0 ? 0 : 0.85) * s;
    const blob = new THREE.Mesh(w.foliageGeo[(seed + k) % w.foliageGeo.length], w.foliage[(seed + k) % 3]);
    blob.position.set(x + Math.cos(a) * r, (3.3 + (k % 3) * 0.35 + (k === 0 ? 0.6 : 0)) * s, z + Math.sin(a) * r);
    blob.scale.setScalar((k === 0 ? 1.25 : 0.95 + (k % 2) * 0.2) * s);
    blob.rotation.y = a;
    blob.castShadow = true;
    blob.receiveShadow = true;
    crown.add(blob);
  }
  w.collider(x - 0.22, z - 0.22, x + 0.22, z + 0.22);
  if (pit) w.box(1.2, 0.04, 1.2, mat('#4b3a2c', 1), x, 0, z, w.scene, false);
}

export function streetLamp(w: World, x: number, z: number, armDir: [number, number], withLight = false) {
  const iron = M.iron();
  w.cyl(0.07, 0.11, 6.2, iron, x, 0, z, w.scene, 10);
  w.cyl(0.16, 0.18, 0.5, iron, x, 0, z, w.scene, 10);
  const arm = w.box(1.6, 0.07, 0.07, iron, x + armDir[0] * 0.8, 6.05, z + armDir[1] * 0.8, w.scene, false);
  arm.rotation.y = Math.atan2(-armDir[1], armDir[0]);
  const head = w.box(0.7, 0.14, 0.32, iron, x + armDir[0] * 1.55, 5.98, z + armDir[1] * 1.55);
  head.rotation.y = arm.rotation.y;
  const lens = w.box(0.55, 0.04, 0.24, w.bulbMat, x + armDir[0] * 1.55, 5.9, z + armDir[1] * 1.55, w.scene, false);
  lens.rotation.y = arm.rotation.y;
  w.collider(x - 0.14, z - 0.14, x + 0.14, z + 0.14);
  if (withLight) {
    const l = new THREE.PointLight('#ffcf8a', 0, 16, 1.4);
    l.position.set(x + armDir[0] * 1.55, 5.7, z + armDir[1] * 1.55);
    w.scene.add(l);
    w.streetLights.push(l);
  }
}

function hydrant(w: World, x: number, z: number) {
  const red = mat('#b3261e', 0.5, 0.2);
  w.cyl(0.13, 0.15, 0.62, red, x, 0, z, w.scene, 12);
  w.cyl(0.16, 0.16, 0.08, red, x, 0.6, z, w.scene, 12);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), red);
  cap.position.set(x, 0.68, z);
  w.scene.add(cap);
  const nub = w.cyl(0.05, 0.05, 0.36, red, x, 0.4, z, w.scene, 8);
  nub.rotation.z = Math.PI / 2;
  w.collider(x - 0.18, z - 0.18, x + 0.18, z + 0.18);
}

function trashCan(w: World, x: number, z: number) {
  w.cyl(0.26, 0.24, 0.95, mat('#2f4a3a', 0.6, 0.3), x, 0, z, w.scene, 14);
  w.cyl(0.28, 0.28, 0.06, mat('#24382c', 0.5, 0.3), x, 0.95, z, w.scene, 14);
  w.collider(x - 0.28, z - 0.28, x + 0.28, z + 0.28);
}

function bench(w: World, x: number, z: number, h: number) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = h;
  w.scene.add(g);
  const wood = mat('#8a5a3a', 0.8);
  const iron = M.iron();
  for (let k = 0; k < 3; k++) w.box(1.8, 0.04, 0.13, wood, 0, 0.44, -0.16 + k * 0.16, g);
  for (let k = 0; k < 2; k++) w.box(1.8, 0.11, 0.035, wood, 0, 0.58 + k * 0.15, -0.26, g);
  for (const lx of [-0.8, 0.8]) { w.box(0.06, 0.44, 0.48, iron, lx, 0, 0, g); w.box(0.05, 0.45, 0.05, iron, lx, 0.44, -0.26, g); }
  const cs = Math.abs(Math.sin(h)) > 0.5;
  w.collider(x - (cs ? 0.3 : 0.95), z - (cs ? 0.95 : 0.3), x + (cs ? 0.3 : 0.95), z + (cs ? 0.95 : 0.3));
  return g;
}

function signPost(w: World, x: number, z: number, a: string, b: string) {
  const iron = M.iron();
  w.cyl(0.04, 0.05, 3.2, iron, x, 0, z, w.scene, 8);
  const green = (t: string, rot: number, y: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 0.03), [mat('#1f5c3a'), mat('#1f5c3a'), mat('#1f5c3a'), mat('#1f5c3a'), new THREE.MeshStandardMaterial({ map: signTexture(t, '#1f5c3a', '#f4f2ea', { w: 512, h: 112 }) }), new THREE.MeshStandardMaterial({ map: signTexture(t, '#1f5c3a', '#f4f2ea', { w: 512, h: 112 }) })]);
    m.position.set(x, y, z);
    m.rotation.y = rot;
    w.scene.add(m);
  };
  green(a, 0, 3.0);
  green(b, Math.PI / 2, 2.72);
}

/** A signal head: three lenses, one material each so the controller can switch them. */
function signal(w: World, x: number, y: number, z: number, rotY: number, axis: 'main' | 'oak') {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  w.scene.add(g);
  w.box(0.32, 0.95, 0.26, mat('#1d1f21', 0.5, 0.3), 0, 0, 0, g);
  const lens = (c: string, yy: number) => {
    const m = new THREE.MeshStandardMaterial({ color: '#202020', emissive: c, emissiveIntensity: 0.05 });
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), m);
    l.position.set(0, yy, 0.135);
    g.add(l);
    return m;
  };
  const r = lens('#ff2a1a', 0.78), yl = lens('#ffb21a', 0.48), gn = lens('#2aff7a', 0.18);
  w.signals.push({ axis, r, y: yl, g: gn });
  for (const yy of [0.78, 0.48, 0.18]) w.box(0.26, 0.03, 0.12, mat('#1d1f21', 0.5), 0, yy + 0.12, 0.17, g, false);
  return g;
}

function trafficPole(w: World, x: number, z: number, armX: number, armZ: number, len: number, heads: { axis: 'main' | 'oak'; rot: number }[]) {
  const iron = mat('#5c6166', 0.4, 0.6);
  w.cyl(0.11, 0.14, 6.4, iron, x, 0, z, w.scene, 12);
  const arm = w.box(len, 0.12, 0.12, iron, x + armX * len / 2, 6.0, z + armZ * len / 2, w.scene, false);
  arm.rotation.y = Math.atan2(-armZ, armX);
  heads.forEach((h, i) => signal(w, x + armX * (len - 0.6 - i * 2.8), 5.35, z + armZ * (len - 0.6 - i * 2.8), h.rot, h.axis));
  signal(w, x, 3.0, z, heads[0].rot, heads[0].axis);
  w.collider(x - 0.16, z - 0.16, x + 0.16, z + 0.16);
}

function parkedCar(w: World, x: number, z: number, rot: number, kind: CarKind, color: string) {
  const car = makeCar(color, kind);
  car.group.position.set(x, z > 4 && z < 12 || x > 34 && x < 42 ? -0.12 : 0, z);
  car.group.rotation.y = rot;
  w.scene.add(car.group);
  const along = Math.abs(Math.cos(rot)) > 0.5;
  const hl = car.length / 2, hw = 1.0;
  w.collider(x - (along ? hl : hw), z - (along ? hw : hl), x + (along ? hl : hw), z + (along ? hw : hl));
}

// ============================================================
export function buildCity(w: World) {
  const loc = w.opts.location;
  const tall = (base: number) => (loc === 'low' ? base : loc === 'average' ? base + 1 : base + 3);

  // ---------- ground, roads, sidewalks ----------
  const base = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), mat('#7d8a6a', 1));
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.16;
  base.receiveShadow = true;
  w.scene.add(base);
  const slab = M.slab();
  const blocks: [number, number, number, number][] = [[-110, -80, 34, 4], [42, -80, 110, 4], [-110, 12, 34, 90], [42, 12, 110, 90]];
  for (const [x0, z0, x1, z1] of blocks) {
    const m = new THREE.Mesh(uvBox(x1 - x0, 0.16, z1 - z0, S.slab), slab);
    m.position.set((x0 + x1) / 2, -0.08, (z0 + z1) / 2);
    m.receiveShadow = true;
    w.scene.add(m);
  }
  const road = M.asphalt();
  const roadPiece = (x0: number, z0: number, x1: number, z1: number) => {
    const m = new THREE.Mesh(uvBox(x1 - x0, 0.04, z1 - z0, S.asphalt), road);
    m.position.set((x0 + x1) / 2, -0.14, (z0 + z1) / 2);
    m.receiveShadow = true;
    w.scene.add(m);
    w.mapRects.push({ x0, z0, x1, z1, kind: 'road' });
  };
  roadPiece(-110, 4, 110, 12);
  roadPiece(34, -80, 42, 4);
  roadPiece(34, 12, 42, 90);
  const curb = mat('#a9a49a', 0.8);
  const curbRun = (x0: number, z0: number, x1: number, z1: number) => w.box(Math.max(0.18, x1 - x0), 0.17, Math.max(0.18, z1 - z0), curb, (x0 + x1) / 2, -0.15, (z0 + z1) / 2, w.scene, false);
  curbRun(-110, 3.9, 34, 4.0); curbRun(42, 3.9, 110, 4.0); curbRun(-110, 12, 34, 12.1); curbRun(42, 12, 110, 12.1);
  curbRun(33.9, -80, 34, 4); curbRun(42, -80, 42.1, 4); curbRun(33.9, 12, 34, 90); curbRun(42, 12, 42.1, 90);
  w.mapRects.push({ x0: -110, z0: 1, x1: 110, z1: 4, kind: 'walk' }, { x0: -110, z0: 12, x1: 110, z1: 15, kind: 'walk' }, { x0: 31, z0: -80, x1: 34, z1: 90, kind: 'walk' }, { x0: 42, z0: -80, x1: 45, z1: 90, kind: 'walk' });

  // markings
  const yellow = mat('#e2b93b', 0.6), white = mat('#eeeae0', 0.6);
  for (const [x0, x1] of [[-110, 30], [46, 110]]) { w.box(x1 - x0, 0.01, 0.1, yellow, (x0 + x1) / 2, -0.115, 7.88, w.scene, false); w.box(x1 - x0, 0.01, 0.1, yellow, (x0 + x1) / 2, -0.115, 8.12, w.scene, false); }
  for (const [z0, z1] of [[-80, 0], [16, 90]]) { w.box(0.1, 0.01, z1 - z0, yellow, 37.88, -0.115, (z0 + z1) / 2, w.scene, false); w.box(0.1, 0.01, z1 - z0, yellow, 38.12, -0.115, (z0 + z1) / 2, w.scene, false); }
  const zebra = (cx: number, cz: number, alongX: boolean, len: number) => {
    for (let k = -len / 2 + 0.3; k < len / 2; k += 0.9) w.box(alongX ? 0.5 : 2.6, 0.01, alongX ? 2.6 : 0.5, white, alongX ? cx + k : cx, -0.112, alongX ? cz : cz + k, w.scene, false);
  };
  zebra(9, 8, false, 7.6);       // mid-block crossing
  zebra(32, 8, false, 7.6);      // Main, west leg
  zebra(44, 8, false, 7.6);      // Main, east leg
  zebra(38, 2.2, true, 7.6);     // Oak, north leg
  zebra(38, 13.8, true, 7.6);    // Oak, south leg
  w.box(0.35, 0.01, 3.8, white, 30.2, -0.112, 10, w.scene, false);
  w.box(0.35, 0.01, 3.8, white, 45.8, -0.112, 6, w.scene, false);
  w.box(3.8, 0.01, 0.35, white, 36, -0.112, 0.4, w.scene, false);
  w.box(3.8, 0.01, 0.35, white, 40, -0.112, 15.6, w.scene, false);
  for (const [x, z] of [[-30, 8], [18, 6.5], [38, -20], [60, 10]]) { const mh = w.cyl(0.35, 0.35, 0.02, mat('#2a2b2c', 0.6, 0.6), x, -0.12, z, w.scene, 18); mh.castShadow = false; }

  // ---------- north side of Main, west to east ----------
  // City Hall, set back behind a plaza
  {
    const stone = M.stone('#d8d0c0');
    const hall = building(w, { x: -55, z: -4, facing: 'S', width: 22, depth: 16, floors: tall(3), wall: 'stone', color: '#d8d0c0', trim: '#cfc6b4', storefront: false, bays: 7, label: 'City Hall' });
    // portico
    for (let k = 0; k < 5; k++) w.box(14, 0.18 * (k + 1), 0.45, stone, -55, 0, -0.35 - k * 0.45);
    w.box(14.4, 0.25, 3.0, stone, -55, 0.9, -2.6);
    for (let i = 0; i < 6; i++) w.cyl(0.32, 0.36, 6.6, stone, -61.25 + i * 2.5, 0.9, -1.6, w.scene, 18);
    w.box(14.6, 0.7, 3.2, stone, -55, 7.5, -2.6);
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-7.3, 0), new THREE.Vector2(7.3, 0), new THREE.Vector2(0, 1.8)]), { depth: 3.0, bevelEnabled: false }), stone);
    ped.position.set(-55, 8.2, -4.1);
    ped.castShadow = true;
    w.scene.add(ped);
    const name = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 0.5), new THREE.MeshStandardMaterial({ map: signTexture('CITY HALL', '#cfc6b4', '#4a4237', { w: 1024, h: 96 }), roughness: 0.8 }));
    name.position.set(-55, 7.86, -0.99);
    w.scene.add(name);
    w.collider(-62, -2.6, -48, -0.1);
    // flagpole
    w.cyl(0.05, 0.07, 9, mat('#c9cdd2', 0.3, 0.8), -46.5, 0, 0.0);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({ map: stripeTexture('#2c4a7a', '#f2efe6', 6), side: THREE.DoubleSide, roughness: 0.9 }));
    flag.position.set(-45.7, 8.4, 0.0);
    w.scene.add(flag);
    w.flags.push(flag);
    w.collider(-46.6, -0.1, -46.4, 0.1);
    for (const x of [-63, -47]) { w.box(1.2, 0.6, 1.2, stone, x, 0, 0.2); w.collider(x - 0.6, -0.4, x + 0.6, 0.8); }
    void hall;
    w.places.push({ id: 'cityhall', name: 'City Hall', x: -55, z: 1.5, h: Math.PI });
  }
  // Okafor Apartments (stoop set into the facade line)
  building(w, { x: -32.5, z: -0.3, facing: 'S', width: 19, depth: 14, floors: tall(4) + 1, wall: 'brick', color: '#8f4a38', trim: '#e2d8c6', storefront: false, fireEscape: true, stoop: true, label: 'Apts', waterTower: loc !== 'low' });
  w.box(19, 0.02, 1.3, M.slab(), -32.5, 0.0, 0.35, w.scene, false);
  w.places.push({ id: 'apartments', name: 'Okafor Apartments', x: -32.5, z: 2.6, h: Math.PI });
  // the bank
  {
    const bk = building(w, { x: -15, z: 1, facing: 'S', width: 12, depth: 15, floors: tall(2), wall: 'stone', color: '#d3cab8', trim: '#c4b9a5', storefront: { sign: signTexture('CIVIC SAVINGS', '#22324a', '#e9dcb8', { sub: 'Loans · Deposits' }), door: 0, dark: true }, label: 'Bank' });
    void bk;
    const stone = M.stone('#d3cab8');
    for (const x of [-19.5, -17.2, -12.8, -10.5]) w.cyl(0.26, 0.3, 3.5, stone, x, 0, 1.45, w.scene, 16);
    w.box(11.6, 0.3, 1.4, stone, -15, 3.5, 1.4);
    w.collider(-20, 1.0, -16.4, 1.8);
    w.collider(-13.6, 1.0, -10, 1.8);
    w.anchors.bank = { x: -15, z: 2.3, r: 1.5 };
    w.places.push({ id: 'bank', name: 'Civic Savings', x: -15, z: 2.9, h: Math.PI });
  }
  // alleys between the north buildings are walled off
  for (const [x0, x1] of [[-44, -42], [-23, -21], [21, 23]] as [number, number][]) {
    w.box(x1 - x0, 2.6, 0.25, M.brick('#7a4c3c'), (x0 + x1) / 2, 0, 0.6);
    w.collider(x0, -14.5, x1, 0.75);
    w.box(1.5, 1.1, 0.9, mat('#3f6b4f', 0.6, 0.3), (x0 + x1) / 2, 0, -0.2);
  }
  // the gym
  building(w, { x: 15, z: 1, facing: 'S', width: 12, depth: 15, floors: tall(2), wall: 'brick', color: '#55595c', trim: '#1f2428', storefront: { sign: signTexture('IRON & OAK GYM', '#1f2428', '#f2b632', { sub: 'Open 5am – 11pm' }), door: 2 }, label: 'Gym' });
  w.places.push({ id: 'gym', name: 'Iron & Oak Gym', x: 15, z: 2.9, h: Math.PI });
  // Bloom Café on the corner
  building(w, { x: 27, z: 1, facing: 'S', width: 8, depth: 15, floors: tall(3), wall: 'plaster', color: '#e5d6bf', trim: '#5b3d4a', storefront: { sign: signTexture('BLOOM CAFÉ', '#5b3d4a', '#f6e7cf', { sub: 'Espresso · Pastry' }), awning: '#5b3d4a', door: -2.5 }, label: 'Café', cornice: true });
  for (const x of [24.6, 28.6]) {
    w.cyl(0.35, 0.35, 0.04, mat('#f1efe8', 0.4), x, 0.72, 3.25, w.scene, 16);
    w.cyl(0.04, 0.06, 0.72, M.iron(), x, 0, 3.25, w.scene, 8);
    w.cyl(0.03, 0.03, 2.2, M.iron(), x, 0.72, 3.25, w.scene, 6);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 12, 1, true), new THREE.MeshStandardMaterial({ map: stripeTexture('#5b3d4a', '#f3efe6', 12), side: THREE.DoubleSide, roughness: 0.9 }));
    um.position.set(x, 2.8, 3.25);
    um.castShadow = true;
    w.scene.add(um);
    w.collider(x - 0.4, 2.85, x + 0.4, 3.65);
  }
  w.places.push({ id: 'cafe', name: 'Bloom Café', x: 26.5, z: 2.4, h: Math.PI });
  // Metro Food Supply depot (north-east corner)
  {
    const corr = M.plaster('#9aa3a6');
    const g = local(w, 55.5, 1, 'S');
    w.box(21, 7.5, 21, corr, 0, 0, -10.5, g);
    for (let x = -10; x <= 10; x += 0.5) w.box(0.06, 7.5, 0.06, mat('#8a9396', 0.5, 0.4), x, 0, 0.0, g, false);
    for (const dx of [-6, 0, 6]) {
      w.box(4.2, 4.4, 0.08, mat('#c9ccc8', 0.5, 0.4), dx, 1.2, 0.05, g, false);
      for (let y = 1.4; y < 5.5; y += 0.3) w.box(4.1, 0.03, 0.1, mat('#a9adaa', 0.5, 0.4), dx, y, 0.08, g, false);
    }
    w.box(21, 1.2, 1.4, M.stone('#b0aa9e'), 0, 0, 0.7, g);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.0), new THREE.MeshStandardMaterial({ map: signTexture('METRO FOOD SUPPLY', '#c23b22', '#ffffff', { sub: 'Wholesale · Est. 1974' }), roughness: 0.6 }));
    sign.position.set(0, 6.4, 0.1);
    g.add(sign);
    w.collider(45, -20, 66, 2.4);
    w.occluders.push({ x0: 45, z0: -20, x1: 66, z1: 1, h: 7.6 });
    w.mapRects.push({ x0: 45, z0: -20, x1: 66, z1: 1, kind: 'building', label: 'Depot' });
    for (let k = 0; k < 3; k++) w.box(1.1, 0.14, 1.1, mat('#9a7a52', 0.9), 50 + k * 1.3, 1.2, 1.3);
    w.places.push({ id: 'depot', name: 'Metro Food Supply', x: 54, z: 3.2, h: Math.PI });
  }

  // ---------- row houses along Oak Ave ----------
  const houseColors = ['#8f4a38', '#6f3f33', '#a8653f', '#7b5a44', '#93533f', '#5f4a3f'];
  for (let i = 0; i < 5; i++) {
    building(w, { x: 29.5, z: -17 - i * 6, facing: 'E', width: 6, depth: 9, floors: 3, groundH: 3.4, wall: 'brick', color: houseColors[i % houseColors.length], trim: '#e2d8c6', storefront: false, stoop: true, bays: 2, cornice: true });
    w.box(0.06, 0.8, 5.0, M.iron(), 31.0, 0, -17 - i * 6 - 0.2, w.scene, false);
  }
  w.collider(29.4, -44.5, 31.05, -14);
  for (let i = 0; i < 4; i++) {
    building(w, { x: 46.5, z: -23 - i * 6, facing: 'W', width: 6, depth: 9, floors: 3, groundH: 3.4, wall: 'brick', color: houseColors[(i + 3) % houseColors.length], trim: '#e9e3d6', storefront: false, stoop: true, bays: 2 });
  }
  w.collider(44.95, -44.5, 46.6, -20);
  w.places.push({ id: 'homes', name: 'Oak Ave homes', x: 32.6, z: -28, h: 0 });
  // north end: a pocket park closes the street
  w.box(14, 0.06, 4, M.grass(), 38, -0.06, -46.5, w.scene);
  for (const x of [32, 44]) tree(w, x, -45.5, 1.1, false);
  w.box(14, 1.0, 0.8, w.hedgeMat, 38, 0, -48.2);

  // ---------- south side of Main ----------
  // construction site (west)
  {
    const dirt = mat('#8b7356', 1);
    w.box(40, 0.05, 22, dirt, -46, -0.03, 26.5, w.scene, false);
    const fencePost = M.iron();
    const mesh = new THREE.MeshStandardMaterial({ color: '#9aa0a5', roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    const fence = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.2), mesh);
      p.position.set((x0 + x1) / 2, 1.1, (z0 + z1) / 2);
      p.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      w.scene.add(p);
      for (let t = 0; t <= len; t += 2.5) w.cyl(0.04, 0.04, 2.3, fencePost, x0 + (x1 - x0) * t / len, 0, z0 + (z1 - z0) * t / len, w.scene, 6);
      w.collider(Math.min(x0, x1) - 0.08, Math.min(z0, z1) - 0.08, Math.max(x0, x1) + 0.08, Math.max(z0, z1) + 0.08);
    };
    fence(-66, 15.5, -45.5, 15.5); fence(-40.5, 15.5, -26, 15.5);
    fence(-66, 15.5, -66, 37.5); fence(-26, 15.5, -26, 37.5); fence(-66, 37.5, -26, 37.5);
    // site boards
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.6), new THREE.MeshStandardMaterial({ map: signTexture('DEE BUILDS', '#f2b632', '#1d1f21', { sub: 'Hard hats beyond this point', w: 1024, h: 400 }), roughness: 0.8 }));
    board.position.set(-50, 1.3, 15.42);
    board.rotation.y = Math.PI;
    w.scene.add(board);
    // concrete slab and steel frame
    w.box(18, 0.4, 12, mat('#a9a7a2', 0.9), -50, 0, 28.5);
    w.collider(-59, 22.5, -41, 34.5);
    const steel = mat('#8a4b2a', 0.6, 0.5);
    for (let fl = 0; fl < 3; fl++) {
      const y = 0.4 + fl * 3.6;
      for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) w.box(0.25, 3.6, 0.25, steel, -58.5 + i * 4.25, y, 23 + j * 5.5);
      for (let j = 0; j <= 2; j++) w.box(17.2, 0.3, 0.2, steel, -50, y + 3.45, 23 + j * 5.5);
      for (let i = 0; i <= 4; i++) w.box(0.2, 0.3, 11.2, steel, -58.5 + i * 4.25, y + 3.45, 28.5);
      if (fl < 2) w.box(17.2, 0.15, 11.2, mat('#b5b2ab', 0.9), -50, y + 3.6, 28.5, w.scene);
    }
    // scaffolding on the street face
    const scaf = mat('#c9ccd0', 0.4, 0.7);
    for (let i = 0; i < 6; i++) w.box(0.06, 9, 0.06, scaf, -58.5 + i * 3.4, 0.4, 21.6, w.scene, false);
    for (let y = 2; y < 10; y += 2.2) { w.box(17.2, 0.05, 0.06, scaf, -50, y, 21.6, w.scene, false); w.box(17.2, 0.06, 0.9, mat('#8a6a42', 0.9), -50, y - 0.1, 21.15, w.scene, false); }
    // tower crane
    const crane = mat('#f2b632', 0.5, 0.3);
    w.box(1.2, 26, 1.2, crane, -33, 0, 32);
    w.box(24, 0.9, 0.9, crane, -42, 26, 32);
    w.box(6, 0.9, 0.9, crane, -27, 26, 32);
    w.box(2.4, 2, 1.6, mat('#7b7f83', 0.6), -25.5, 24, 32);
    w.box(1.6, 1.4, 1.4, mat('#2b2e31', 0.5), -33, 26.9, 32);
    w.cyl(0.02, 0.02, 14, mat('#222', 0.4), -50, 12, 32, w.scene, 4);
    w.collider(-33.8, 31.2, -32.2, 32.8);
    // materials, cones, porta-potty, site trailer
    for (let k = 0; k < 4; k++) w.box(1.2, 0.8, 1.2, mat('#a5523e', 0.9), -38 + k * 1.5, 0, 19.5);
    w.collider(-38.8, 18.8, -32.8, 20.2);
    for (let k = 0; k < 5; k++) { const pipe = w.cyl(0.2, 0.2, 5, mat('#5b6066', 0.4, 0.6), -34, 0.2 + k * 0.4 % 0.8, 24 + (k % 3) * 0.42, w.scene, 12); pipe.rotation.x = Math.PI / 2; }
    w.collider(-34.3, 21.5, -33.7, 26.5);
    w.box(1.3, 2.3, 1.3, mat('#2f6fb3', 0.5), -29, 0, 35.5);
    w.collider(-29.7, 34.8, -28.3, 36.2);
    w.box(7, 2.6, 2.6, mat('#e7e3d9', 0.6), -61, 0, 19);
    w.collider(-64.5, 17.7, -57.5, 20.3);
    for (const [x, z] of [[-46, 15.9], [-40, 15.9]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 12), mat('#ff6a1f', 0.6)); c.position.set(x, 0.3, z); c.castShadow = true; w.scene.add(c); }
    w.mapRects.push({ x0: -66, z0: 15.5, x1: -26, z1: 37.5, kind: 'site', label: 'Construction' });
    w.places.push({ id: 'site', name: 'Construction site', x: -43, z: 17.5, h: 0 });
  }
  // laundromat
  building(w, { x: -15, z: 15, facing: 'N', width: 12, depth: 13, floors: tall(2), wall: 'plaster', color: '#9fc4cf', trim: '#2f6f7a', storefront: { sign: signTexture('SUDS LAUNDRY', '#f2efe8', '#2f6f7a', { sub: 'Wash · Dry · Fold' }), door: 3 }, label: 'Laundry' });
  w.box(3, 2.6, 0.2, M.brick('#7a4c3c'), -22.5, 0, 15.1);
  w.collider(-26.1, 15, -21, 28.1);
  w.box(2.0, 2.6, 0.2, M.brick('#7a4c3c'), -8, 0, 15.1);
  w.collider(-9, 15, -7, 28.1);
  w.box(2.0, 2.6, 0.2, M.brick('#7a4c3c'), 8, 0, 15.1);
  w.collider(7, 15, 9, 28.1);

  // the rival storefront across the street (custom: it changes hands)
  const riv = building(w, { x: 0, z: 15, facing: 'N', width: 14, depth: 13, floors: tall(2), wall: 'brick', color: '#a35d48', trim: '#2c2a28', storefront: false, label: 'Rival' });
  void riv;
  w.places.push({ id: 'rival', name: 'Across the street', x: 0, z: 13.2, h: 0 });

  // ---------- market square ----------
  {
    const gm = M.grass();
    const lawn = new THREE.Mesh(uvBox(17, 0.06, 12.5, S.grass), gm);
    lawn.position.set(17.5, -0.02, 21.4);
    lawn.receiveShadow = true;
    w.scene.add(lawn);
    w.mapRects.push({ x0: 9, z0: 15, x1: 26, z1: 28, kind: 'park', label: 'Market Sq' });
    const pathM = M.stone('#d8cdb5');
    const p1 = new THREE.Mesh(uvBox(3, 0.08, 12.5, S.stone), pathM); p1.position.set(17.5, -0.01, 21.4); p1.receiveShadow = true; w.scene.add(p1);
    const p2 = new THREE.Mesh(uvBox(17, 0.08, 2.4, S.stone), pathM); p2.position.set(17.5, -0.01, 22); p2.receiveShadow = true; w.scene.add(p2);
    const stone = M.stone('#bdb5a6');
    w.cyl(2.0, 2.1, 0.55, stone, 17.5, 0, 22, w.scene, 32);
    w.collider(15.6, 20.1, 19.4, 23.9);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.05, 32), new THREE.MeshStandardMaterial({ color: '#3f7f9e', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.88 }));
    water.position.set(17.5, 0.5, 22);
    water.userData.keep = true;
    w.scene.add(water);
    w.cyl(0.25, 0.35, 1.3, stone, 17.5, 0.5, 22, w.scene, 16);
    w.cyl(0.7, 0.5, 0.15, stone, 17.5, 1.8, 22, w.scene, 20);
    bench(w, 13.2, 19.0, Math.PI / 2);
    const b2 = bench(w, 13.2, 25.0, Math.PI / 2);
    bench(w, 21.8, 25.6, -Math.PI / 2);
    w.anchors.june = { x: 13.95, z: 19.0, r: 1.4 };
    w.anchors.bench = { x: 13.9, z: 25.0, r: 1.3, mesh: b2 };
    w.seats.push({ x: 13.4, z: 25.0, h: Math.PI / 2, y: 0.47, sit: true, taken: true, approach: { x: 14.2, z: 25.0 } });
    const stall = (x: number, z: number, color: string, goods: string[]) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      w.scene.add(g);
      const wood = mat('#9a7448', 0.8);
      w.box(2.4, 0.9, 1.0, wood, 0, 0, 0, g);
      for (const [px, pz] of [[-1.15, -0.45], [1.15, -0.45], [-1.15, 0.45], [1.15, 0.45]]) w.box(0.08, 2.4, 0.08, wood, px, 0, pz, g, false);
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.5), new THREE.MeshStandardMaterial({ map: stripeTexture(color, '#f6f1e6', 8), side: THREE.DoubleSide, roughness: 0.9 }));
      roof.position.set(0, 2.45, 0);
      roof.rotation.x = -Math.PI / 2 + 0.25;
      roof.castShadow = true;
      g.add(roof);
      goods.forEach((c, i) => {
        const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(c, 0.55));
        fruit.position.set(-0.9 + (i % 9) * 0.22, 0.98, -0.2 + Math.floor(i / 9) * 0.22);
        g.add(fruit);
      });
      w.box(0.5, 0.3, 0.4, mat('#a5794c', 0.9), 0.8, 0.9, 0.2, g);
      w.collider(x - 1.25, z - 0.55, x + 1.25, z + 0.55);
      return g;
    };
    const s1 = stall(23.0, 18.0, '#3f7a5a', Array.from({ length: 18 }, (_, i) => ['#d94a3a', '#f0c23c', '#ff8a3d', '#6fae4a'][i % 4]));
    stall(23.0, 21.4, '#b23a2e', Array.from({ length: 18 }, (_, i) => ['#e8d9b0', '#c99a63', '#8a5a3a'][i % 3]));
    w.anchors.market = { x: 21.2, z: 19.7, r: 2.0, mesh: s1 };
    w.clickables.push(s1);
    w.box(17, 1.1, 0.8, w.hedgeMat, 17.5, 0, 27.6);
    w.collider(9, 27.2, 26, 28.0);
    for (const [x, z] of [[10.5, 16.5], [10.5, 26], [25, 16.2], [25, 26.5], [14.5, 16.2], [20.5, 26.5]]) tree(w, x, z, 1.1, false);
    w.places.push({ id: 'market', name: 'Market Square', x: 17.5, z: 17.2, h: 0 });
  }
  // court and garden south of the square (reached from Oak Ave)
  {
    const ct = new THREE.Mesh(uvBox(15, 0.06, 13, S.asphalt), M.asphalt());
    ct.position.set(19, -0.03, 38);
    ct.receiveShadow = true;
    w.scene.add(ct);
    const line = mat('#f1efe8', 0.6);
    w.box(14, 0.01, 0.08, line, 19, 0.005, 31.6, w.scene, false);
    w.box(14, 0.01, 0.08, line, 19, 0.005, 44.4, w.scene, false);
    w.box(0.08, 0.01, 12.8, line, 12.1, 0.005, 38, w.scene, false);
    w.box(0.08, 0.01, 12.8, line, 25.9, 0.005, 38, w.scene, false);
    w.box(14, 0.01, 0.08, line, 19, 0.005, 38, w.scene, false);
    for (const z of [32.2, 43.8]) {
      w.cyl(0.08, 0.08, 3.2, M.iron(), 19, 0, z + (z < 38 ? -0.9 : 0.9), w.scene, 8);
      w.box(1.2, 0.8, 0.05, mat('#f4f4f2', 0.4), 19, 2.9, z, w.scene, false);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 6, 16), mat('#e05a1f', 0.5, 0.4));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(19, 3.05, z + (z < 38 ? 0.3 : -0.3));
      w.scene.add(ring);
    }
    w.mapRects.push({ x0: 11.5, z0: 31.5, x1: 26.5, z1: 44.5, kind: 'lot', label: 'Court' });
    // fences closing the area
    const ironM = M.iron();
    for (const [x0, z0, x1, z1] of [[9, 28, 9, 50], [9, 50, 31, 50]] as [number, number, number, number][]) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (let t = 0; t <= len; t += 0.25) w.box(0.03, 1.4, 0.03, ironM, x0 + (x1 - x0) * t / len, 0, z0 + (z1 - z0) * t / len, w.scene, false);
      w.box(Math.max(0.05, x1 - x0), 0.05, Math.max(0.05, z1 - z0), ironM, (x0 + x1) / 2, 1.4, (z0 + z1) / 2, w.scene, false);
      w.collider(Math.min(x0, x1) - 0.1, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, Math.max(z0, z1) + 0.1);
    }
    for (const [x, z] of [[11, 30], [28, 30], [28, 47], [11, 47]]) tree(w, x, z, 1.0, false);
    bench(w, 28.5, 38, -Math.PI / 2);
    w.places.push({ id: 'court', name: 'The court', x: 29.4, z: 34, h: -Math.PI / 2 });
  }
  // south-east: Harbor Diner and its lot
  {
    building(w, { x: 55.5, z: 15, facing: 'N', width: 14, depth: 10, floors: 1, groundH: 4.2, wall: 'plaster', color: '#d9e2e4', trim: '#b23a2e', storefront: { sign: signTexture('HARBOR DINER', '#b23a2e', '#fff6e8', { sub: 'Open 24 hours' }), door: -3 }, label: 'Diner', cornice: false });
    const lot = new THREE.Mesh(uvBox(21, 0.06, 16, S.asphalt), M.asphalt());
    lot.position.set(55.5, -0.03, 33);
    lot.receiveShadow = true;
    w.scene.add(lot);
    for (let i = 0; i < 7; i++) w.box(0.1, 0.01, 4.5, mat('#eeeae0', 0.6), 46.5 + i * 3, 0.005, 29, w.scene, false);
    for (let i = 0; i < 6; i += 2) parkedCar(w, 48 + i * 3, 29, Math.PI / 2, (['sedan', 'suv', 'hatch'] as CarKind[])[i % 3], CAR_COLORS[(i + 2) % CAR_COLORS.length]);
    w.mapRects.push({ x0: 45, z0: 25, x1: 66, z1: 41, kind: 'lot', label: 'Lot' });
    // close the lot
    w.collider(45, 41, 66, 42); w.collider(66, 15, 67, 42);
    w.box(21, 1.0, 0.6, w.hedgeMat, 55.5, 0, 41.3);
    w.places.push({ id: 'diner', name: 'Harbor Diner', x: 52, z: 13.6, h: Math.PI });
  }
  for (let i = 0; i < 3; i++) building(w, { x: 46.5, z: 46 + i * 6, facing: 'W', width: 6, depth: 9, floors: 3, groundH: 3.4, wall: 'brick', color: houseColors[(i + 4) % houseColors.length], trim: '#e9e3d6', storefront: false, stoop: true, bays: 2 });

  // far filler on both ends of Main
  const filler: [number, number, number, 'S' | 'N', number][] = [[-80, 1, 22, 'S', 4], [80, 1, 22, 'S', 5], [-80, 15, 22, 'N', 3], [80, 15, 22, 'N', 4]];
  for (const [x, z, wdt, f, fl] of filler) building(w, { x, z, facing: f, width: wdt, depth: 14, floors: tall(fl), wall: 'brick', color: ['#9a5b4a', '#7b6a5c', '#a8653f', '#6d5a4a'][Math.abs(x + z) % 4], storefront: { door: 0 } });
  if (loc === 'high') {
    for (let i = 0; i < 8; i++) {
      const x = -90 + i * 26;
      building(w, { x, z: -24, facing: 'S', width: 18, depth: 14, floors: 9 + ((i * 5) % 7), wall: i % 2 ? 'stone' : 'brick', color: ['#8a8f94', '#a89a86', '#6e7680'][i % 3], storefront: false, cornice: i % 2 === 0, waterTower: i % 3 === 0 });
    }
  }

  // ---------- street furniture ----------
  for (const x of [-60, -40, -20, 6, 20, 52]) streetLamp(w, x, 3.75, [0, 1], x === 6);
  for (const x of [-50, -30, -2, 20, 50]) streetLamp(w, x, 12.25, [0, -1], false);
  for (const z of [-40, -24]) { streetLamp(w, 33.75, z, [1, 0]); streetLamp(w, 42.25, z + 8, [-1, 0]); }
  for (const z of [26, 44]) streetLamp(w, 42.25, z, [-1, 0]);
  for (const x of [-44, -26, -11.5, 11.5, 22, 50, 62]) tree(w, x, 3.5, 0.95);
  for (const x of [-18, -4.5, 4.5, 50]) tree(w, x, 12.5, 0.95);
  for (const z of [-36, -30, -24]) tree(w, 33.4, z, 0.9);
  for (const z of [26, 34]) tree(w, 33.4, z, 0.9);
  hydrant(w, -24.5, 3.5); hydrant(w, 8.0, 3.5); hydrant(w, 44.6, 14.6); hydrant(w, 33.4, -10);
  trashCan(w, -8.2, 3.4); trashCan(w, 21.6, 3.4); trashCan(w, -24.5, 14.6); trashCan(w, 30.5, 14.6);
  signPost(w, 33.6, 3.6, 'MAIN ST', 'OAK AVE');
  // mailbox + news box + bike rack by the shop
  w.box(0.5, 1.05, 0.45, mat('#21407a', 0.5, 0.2), -6.2, 0, 3.45);
  w.collider(-6.45, 3.22, -5.95, 3.68);
  w.box(0.45, 1.0, 0.4, mat('#c8312e', 0.5), -5.5, 0, 3.5);
  w.collider(-5.73, 3.3, -5.27, 3.7);
  // bus stop on the south walk
  {
    const shelter = mat('#2b2e31', 0.4, 0.5);
    w.box(3.2, 0.1, 1.3, shelter, -16, 2.5, 13.9);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, 0.04), w.glass);
    back.position.set(-16, 1.4, 14.5);
    w.scene.add(back);
    for (const x of [-17.55, -14.45]) w.box(0.06, 2.5, 0.06, shelter, x, 0, 14.5, w.scene, false);
    w.box(2.4, 0.06, 0.4, mat('#8a5a3a', 0.8), -16, 0.46, 14.2);
    w.collider(-17.6, 14.0, -14.4, 14.6);
  }
  // the ad column
  {
    const col = w.cyl(0.55, 0.55, 2.6, new THREE.MeshStandardMaterial({ map: signTexture('ADVERTISE HERE', '#efe6c8', '#b23a2e', { w: 512, h: 512, sub: 'Local · Citywide' }), roughness: 0.8 }), -11.5, 0, 14.5, w.scene, 24);
    w.cyl(0.62, 0.62, 0.25, mat('#2f4a3f', 0.6), -11.5, 2.6, 14.5);
    w.collider(-12.1, 13.95, -10.9, 15.1);
    w.anchors.ads = { x: -11.5, z: 13.2, r: 1.3, mesh: col };
    w.clickables.push(col);
  }
  // traffic signals on the four corners of Main & Oak
  trafficPole(w, 33.4, 12.6, 0, -1, 7.5, [{ axis: 'main', rot: -Math.PI / 2 }]);   // faces eastbound traffic (coming from the west)
  trafficPole(w, 42.6, 3.4, 0, 1, 7.5, [{ axis: 'main', rot: Math.PI / 2 }]);      // faces westbound traffic
  trafficPole(w, 33.4, 3.4, 1, 0, 7.5, [{ axis: 'oak', rot: Math.PI }]);           // faces southbound
  trafficPole(w, 42.6, 12.6, -1, 0, 7.5, [{ axis: 'oak', rot: 0 }]);               // faces northbound
  // parked cars along Oak Ave
  const kinds: CarKind[] = ['sedan', 'hatch', 'suv'];
  [[-32, 0], [-26, 1], [-14, 2], [22, 0], [28, 1], [38, 2]].forEach(([z, k], i) => parkedCar(w, 34.95, z, i % 2 ? Math.PI / 2 : Math.PI / 2, kinds[k], CAR_COLORS[(i * 3) % CAR_COLORS.length]));
  [[-38, 1], [-30, 0], [26, 2], [44, 0]].forEach(([z, k], i) => parkedCar(w, 41.05, z, -Math.PI / 2, kinds[k], CAR_COLORS[(i * 5 + 1) % CAR_COLORS.length]));
  parkedCar(w, 41.0, -11, -Math.PI / 2, 'truck', '#c23b22');
}
