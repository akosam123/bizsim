// The world: your shop (floor, back of house, office) set into a full
// neighbourhood (see city.ts). Everything here is scenery, lighting and the
// anchors gameplay hangs off.
import * as THREE from 'three';
import type { BusinessId, LocationId, Venue } from '../../src/game/types';
import type { CharacterId } from '../../src/game/cast';
import { Box, NavGrid, P2 } from './nav';
import { mat } from './people';
import { batch } from './batch';
import { buildCity, M, uvBox } from './city';
import {
  carpet, menuBoardTexture, paperTexture, planks, plaster, pbr, signTexture, skyMaterial, stripeTexture, tiles,
} from './textures';

export interface Spot { x: number; z: number; h: number }
export interface Seat extends Spot { y: number; sit: boolean; taken: boolean; approach: P2 }
export interface WallSeg { full: THREE.Object3D; short?: THREE.Object3D; px: number; pz: number; nx: number; nz: number }
export interface Anchor { x: number; z: number; r: number; mesh?: THREE.Object3D }
export interface MapRect { x0: number; z0: number; x1: number; z1: number; kind: 'road' | 'walk' | 'building' | 'park' | 'lot' | 'site' | 'shop'; label?: string }
export interface Place { id: string; name: string; x: number; z: number; h: number }
export interface Home { x: number; z: number; h: number; sit?: boolean; sitY?: number }

export const SHOP = { x0: -7, x1: 7, z0: -13, z1: 1 };
export const BOUNDS = { x0: -66, x1: 66, z0: -45, z1: 51 };

export function groundY(x: number, z: number) {
  return (z > 4.15 && z < 11.85) || (x > 34.15 && x < 41.85) ? -0.12 : 0;
}

export function insideShop(x: number, z: number) {
  return x > SHOP.x0 && x < SHOP.x1 && z > SHOP.z0 && z < SHOP.z1 - 0.15;
}

export function roomOf(x: number, z: number): Venue | 'outside' {
  if (!insideShop(x, z)) return z < 4 && Math.abs(x) < 12 ? 'street' : 'outside';
  if (z > -6) return 'inside';
  return x < 1.5 ? 'back' : 'office';
}

const FACADE: Record<BusinessId, { wall: string; trim: string; paint: string; wainscot: string; brick: boolean }> = {
  restaurant: { wall: '#8c4a3b', trim: '#2d2a26', paint: '#efe3d3', wainscot: '#5a3b2b', brick: true },
  coffee: { wall: '#2f4a3f', trim: '#c9b48a', paint: '#ebe4d8', wainscot: '#2f4a3f', brick: false },
  bakery: { wall: '#e8d6b8', trim: '#8a5a3a', paint: '#f7eddd', wainscot: '#d9b89a', brick: false },
  convenience: { wall: '#e3e6e8', trim: '#2c5d9c', paint: '#f4f5f3', wainscot: '#c8ced4', brick: false },
  barber: { wall: '#27334a', trim: '#c8a24a', paint: '#ece7df', wainscot: '#27334a', brick: false },
};

/** Where each recurring character spends their day when nobody needs them. */
export const HOMES: Partial<Record<CharacterId, Home>> = {
  accountant: { x: 4.4, z: -9.45, h: Math.PI, sit: true, sitY: 0.47 },
  manager: { x: -5.3, z: -8.2, h: 0.4 },
  neighbor: { x: 16.4, z: 3.3, h: -2.6 },
  regular: { x: 13.45, z: 19.0, h: Math.PI / 2, sit: true, sitY: 0.47 },
  banker: { x: -12.7, z: 3.3, h: 2.6 },
  supplier: { x: 53.5, z: 3.3, h: Math.PI },
  contractor: { x: -43, z: 18.6, h: 0 },
  inspector: { x: -52.5, z: 0.6, h: 0.3 },
  landlord: { x: -31.2, z: 1.3, h: 0.2 },
  influencer: { x: 25.35, z: 3.25, h: -Math.PI / 2, sit: true, sitY: 0.47 },
  rival: { x: 52, z: 14.6, h: 0.3 },
};

export interface WorldOpts {
  business: BusinessId;
  location: LocationId;
  accent: string;
  shopName: string;
  tagline: string;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly colliders: Box[] = [];
  nav!: NavGrid;
  readonly walls: WallSeg[] = [];
  readonly roofParts: THREE.Object3D[] = [];
  readonly ceiling: THREE.Object3D[] = [];
  readonly clickables: THREE.Object3D[] = [];
  readonly anchors: Record<string, Anchor> = {};
  readonly spots: Record<Venue, Spot[]> = { street: [], inside: [], back: [], office: [] };
  readonly seats: Seat[] = [];
  readonly queue: P2[] = [];
  readonly staffSpots: Spot[] = [];
  readonly backStaffSpots: Spot[] = [];
  readonly mapRects: MapRect[] = [];
  readonly occluders: { x0: number; z0: number; x1: number; z1: number; h: number }[] = [];
  readonly places: Place[] = [];
  readonly signals: { axis: 'main' | 'oak'; r: THREE.MeshStandardMaterial; y: THREE.MeshStandardMaterial; g: THREE.MeshStandardMaterial }[] = [];
  readonly signMats: THREE.MeshStandardMaterial[] = [];
  readonly flags: THREE.Mesh[] = [];
  readonly crowns: { g: THREE.Group; x: number; y: number; z: number; r: number }[] = [];
  readonly door = { out: { x: 0, z: 2.2 }, in: { x: 0, z: -0.4 } };
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private sky: THREE.Mesh;
  readonly skyMat: THREE.ShaderMaterial;
  private envMaps: { t: number; tex: THREE.Texture }[] = [];
  private interiorLights: THREE.PointLight[] = [];
  readonly streetLights: THREE.PointLight[] = [];
  readonly bulbMat = new THREE.MeshStandardMaterial({ color: '#fff2d0', emissive: '#ffcc80', emissiveIntensity: 0 });
  readonly windowLit = new THREE.MeshStandardMaterial({ color: '#58697a', roughness: 0.12, metalness: 0.2, emissive: '#ffc77a', emissiveIntensity: 0 });
  readonly windowDark = new THREE.MeshStandardMaterial({ color: '#4a5a69', roughness: 0.1, metalness: 0.3 });
  readonly shopGlassOut = new THREE.MeshStandardMaterial({ color: '#5c6f7e', roughness: 0.08, metalness: 0.2, emissive: '#ffd9a0', emissiveIntensity: 0 });
  readonly glass = new THREE.MeshStandardMaterial({ color: '#b8d4e3', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.2, depthWrite: false });
  readonly foliage: THREE.MeshStandardMaterial[] = [];
  readonly foliageGeo: THREE.BufferGeometry[] = [];
  readonly hedgeMat = new THREE.MeshStandardMaterial({ color: '#4d7a3f', roughness: 1 });
  private snow: THREE.Points | null = null;
  private rivalSign!: THREE.Mesh;
  private rivalLease!: THREE.Object3D;
  private rivalInterior!: THREE.Object3D;
  private menuBoard!: THREE.Mesh;
  private renoProps = new THREE.Group();
  readonly opts: WorldOpts;
  private floors: number;
  private t = 0;
  private cutaway = false;
  private clock = 0;
  userSign: THREE.MeshStandardMaterial | null = null;
  shopOccluder = { x0: -7, z0: -13, x1: 7, z1: 1, h: 3.7 };
  /** first-person: keep roofs and ceilings, never cut walls */
  firstPerson = false;

  constructor(opts: WorldOpts) {
    this.opts = opts;
    this.floors = opts.location === 'low' ? 0 : opts.location === 'average' ? 1 : 3;
    const s = this.scene;
    s.fog = new THREE.Fog('#dfe7ec', 70, 260);

    this.skyMat = skyMaterial();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), this.skyMat);
    this.sky.frustumCulled = false;
    s.add(this.sky);

    this.hemi = new THREE.HemisphereLight('#cfe3ff', '#8c7b62', 0.35);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1dc', 2.8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.035;
    s.add(this.sun, this.sun.target);

    // shared foliage: three tints, a few lumpy crown shapes
    for (const c of ['#56813e', '#6a9248', '#4c7438']) this.foliage.push(new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    for (let k = 0; k < 4; k++) {
      const g = new THREE.IcosahedronGeometry(1, 3);
      const p = g.attributes.position as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = 1 + 0.18 * Math.sin(v.x * 4.1 + k) * Math.sin(v.y * 3.7 + k * 2) * Math.sin(v.z * 4.3) + 0.08 * Math.sin(v.x * 11 + v.z * 9 + k);
        v.multiplyScalar(n);
        p.setXYZ(i, v.x, v.y * 0.85, v.z);
      }
      g.computeVertexNormals();
      this.foliageGeo.push(g);
    }

    this.buildShop();
    this.buildRivalFront();
    buildCity(this);
    this.places.unshift(
      { id: 'floor', name: 'Your shop · floor', x: 0.3, z: -1.9, h: -2.3 },
      { id: 'back', name: 'Your shop · back room', x: -2.6, z: -7.6, h: Math.PI },
      { id: 'office', name: 'Your shop · office', x: 3.2, z: -7.6, h: Math.PI },
      { id: 'street', name: 'Main Street', x: 0, z: 2.8, h: Math.PI },
    );

    // invisible boundary
    this.collider(BOUNDS.x0 - 1, BOUNDS.z0 - 1, BOUNDS.x0, BOUNDS.z1 + 1);
    this.collider(BOUNDS.x1, BOUNDS.z0 - 1, BOUNDS.x1 + 1, BOUNDS.z1 + 1);
    this.collider(BOUNDS.x0, BOUNDS.z1, BOUNDS.x1, BOUNDS.z1 + 1);
    this.collider(BOUNDS.x0, BOUNDS.z0 - 1, BOUNDS.x1, BOUNDS.z0);
    this.nav = new NavGrid(BOUNDS.x0, BOUNDS.z0, BOUNDS.x1, BOUNDS.z1, 0.3);
    for (const b of this.colliders) this.nav.addBox(b, 0.3);

    s.add(this.renoProps);
    // fold static scenery into a few big meshes; keep anything that toggles or gets clicked
    const keep = new Set<THREE.Object3D>([this.sky, this.renoProps, this.rivalInterior, this.rivalLease, this.rivalSign, this.menuBoard, ...this.roofParts, ...this.ceiling, ...this.clickables, ...this.flags, ...this.crowns.map((c) => c.g)]);
    for (const w of this.walls) { keep.add(w.full); if (w.short) keep.add(w.short); }
    batch(s, keep);
    for (const r of [...this.roofParts, ...this.ceiling]) if (!(r as THREE.Mesh).isMesh) batch(r);
    for (const c of this.crowns) batch(c.g);
    this.setTime(0);
  }

  /** Bake a few sky-lit environment maps (morning → dusk) for reflections and fill light. */
  initEnv(renderer: THREE.WebGLRenderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const skyM = skyMaterial();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyM);
    envScene.add(dome);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#77715f' }));
    ground.position.y = -2;
    envScene.add(ground);
    for (const t of [0, 0.45, 0.8, 1]) {
      this.setTime(t);
      for (const k of ['top', 'bottom', 'sunColor', 'sunDir', 'cover'] as const) {
        const v = this.skyMat.uniforms[k].value;
        skyM.uniforms[k].value = v.clone ? v.clone() : v;
      }
      (ground.material as THREE.MeshBasicMaterial).color.set(t > 0.9 ? '#3a3530' : '#6f6a5a');
      const rt = pm.fromScene(envScene, 0.02);
      this.envMaps.push({ t, tex: rt.texture });
    }
    pm.dispose();
    this.setTime(this.t);
  }

  // ---------- helpers ----------
  collider(x0: number, z0: number, x1: number, z1: number) {
    this.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  /** Box with its base at y. */
  box(w: number, h: number, d: number, m: THREE.Material | string, x: number, y: number, z: number, parent: THREE.Object3D = this.scene, shadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === 'string' ? mat(m) : m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  cyl(rt: number, rb: number, h: number, m: THREE.Material | string, x: number, y: number, z: number, parent: THREE.Object3D = this.scene, seg = 16) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof m === 'string' ? mat(m) : m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  solid(w: number, h: number, d: number, m: THREE.Material | string, x: number, z: number, y = 0, parent: THREE.Object3D = this.scene) {
    this.collider(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    return this.box(w, h, d, m, x, y, z, parent);
  }

  plane(w: number, d: number, m: THREE.Material, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  wall(x0: number, z0: number, x1: number, z1: number, h: number, m: THREE.Material | string, inward: [number, number], t = 0.2, uvScale = 0) {
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = along ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const w = along ? len : t, d = along ? t : len;
    const mm = typeof m === 'string' ? mat(m) : m;
    const full = new THREE.Mesh(uvScale ? uvBox(w, h, d, uvScale) : new THREE.BoxGeometry(w, h, d), mm);
    full.position.set(cx, h / 2, cz);
    full.castShadow = full.receiveShadow = true;
    this.scene.add(full);
    const short = this.box(w, 0.32, d, mm, cx, 0, cz);
    short.visible = false;
    this.collider(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
    this.walls.push({ full, short, px: cx, pz: cz, nx: inward[0], nz: inward[1] });
    return full;
  }

  // ---------- your shop ----------
  private buildShop() {
    const o = this.opts;
    const f = FACADE[o.business];
    const H = 3.4;
    const facadeMat = f.brick ? M.brick(f.wall) : M.plaster(f.wall);
    const fScale = f.brick ? 1.75 : 2.2;
    const paint = new THREE.MeshStandardMaterial({ color: f.paint, roughness: 0.9 });
    const trim = mat(f.trim, 0.55);

    // floors with real texture
    const floorMat = {
      restaurant: pbr(planks('#8a5a3a'), [5, 2.5], { rough: 0.55 }),
      coffee: pbr(planks('#6f4a32'), [5, 2.5], { rough: 0.6 }),
      bakery: pbr(tiles('#f1e3cf', '#e0c6a3', 8), [3.5, 1.75], { rough: 0.45 }),
      convenience: pbr(tiles('#eceeeb', '#dfe2de', 8), [3.5, 1.75], { rough: 0.35 }),
      barber: pbr(tiles('#f2f2ef', '#262626', 8), [3.5, 1.75], { rough: 0.3 }),
    }[o.business];
    this.plane(14, 7, floorMat, 0, 0.005, -2.5);
    this.plane(8.5, 7, pbr(tiles('#c9ccc9', '#bec2bf', 8), [2.2, 1.8], { rough: 0.4 }), -2.75, 0.005, -9.5);
    this.plane(5.5, 7, pbr(carpet('#53626e'), [3, 3], { rough: 1 }), 4.25, 0.005, -9.5);
    this.mapRects.push({ x0: -7, z0: -13, x1: 7, z1: 1, kind: 'shop', label: 'Your shop' });
    this.shopOccluder = { x0: -7, z0: -13, x1: 7, z1: 1, h: 3.7 + this.floors * 3.1 };

    // exterior walls: outer skin + inner painted skin
    const side = (x: number, inward: number) => {
      this.wall(x, -13, x, 1, H, facadeMat, [inward, 0], 0.12, fScale);
      const inner = this.box(0.08, H - 0.05, 14, paint, x + inward * 0.1, 0, -6);
      this.walls[this.walls.length - 1].full = groupOf(this.walls[this.walls.length - 1].full, inner);
    };
    side(-7, 1);
    side(7, -1);
    this.wall(-7, -13, 7, -13, H, facadeMat, [0, 1], 0.12, fScale);
    const backInner = this.box(14, H - 0.05, 0.08, paint, 0, 0, -12.9);
    this.walls[this.walls.length - 1].full = groupOf(this.walls[this.walls.length - 1].full, backInner);
    const wain = mat(f.wainscot, 0.7);
    this.box(0.04, 0.9, 7, wain, -6.84, 0, -2.5);
    this.box(0.04, 0.9, 7, wain, 6.84, 0, -2.5);
    for (const [x, z, w, d] of [[-6.85, -9.5, 0.03, 7], [6.85, -9.5, 0.03, 7], [0, -12.85, 14, 0.03]] as [number, number, number, number][]) this.box(w, 0.1, d, mat('#3a3330', 0.6), x, 0, z, this.scene, false);

    // storefront (front wall at z = 1)
    const front = new THREE.Group();
    this.scene.add(front);
    const kick = (x0: number, x1: number) => this.box(x1 - x0, 0.55, 0.22, trim, (x0 + x1) / 2, 0, 0.9);
    kick(-7, -1); kick(1, 7);
    this.collider(-7, 0.79, -1, 1.01);
    this.collider(1, 0.79, 7, 1.01);
    for (const [x0, x1] of [[-7, -1], [1, 7]]) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 2.15, 0.04), this.glass);
      g.position.set((x0 + x1) / 2, 0.55 + 1.075, 0.9);
      front.add(g);
      for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 3) this.box(0.1, 2.2, 0.16, trim, x, 0.55, 0.9, front);
      this.box(x1 - x0, 0.08, 0.2, trim, (x0 + x1) / 2, 2.65, 0.9, front);
    }
    this.box(0.14, 2.75, 0.24, trim, -1.0, 0, 0.9, front);
    this.box(0.14, 2.75, 0.24, trim, 1.0, 0, 0.9, front);
    const leaf = new THREE.Group();
    leaf.position.set(-0.93, 0, 0.82);
    leaf.rotation.y = -1.35;
    this.box(0.9, 2.3, 0.05, this.glass, 0.45, 0.05, 0, leaf);
    this.box(0.9, 0.12, 0.07, trim, 0.45, 0.05, 0, leaf);
    this.box(0.9, 0.12, 0.07, trim, 0.45, 2.25, 0, leaf);
    this.box(0.05, 0.3, 0.05, mat('#c9b48a', 0.3, 0.8), 0.8, 1.05, 0.05, leaf);
    front.add(leaf);
    const header = new THREE.Mesh(uvBox(14.2, H - 2.73, 0.26, fScale), facadeMat);
    header.position.set(0, 2.73 + (H - 2.73) / 2, 0.92);
    header.castShadow = true;
    front.add(header);
    const signTex = signTexture(o.shopName, o.accent, '#fffaf0', { sub: o.tagline });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.62), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0 }));
    sign.position.set(0, 3.06, 1.07);
    front.add(sign);
    this.userSign = sign.material as THREE.MeshStandardMaterial;
    const awn = new THREE.MeshStandardMaterial({ map: stripeTexture(o.accent, '#f6f1e6', 10), roughness: 0.9, side: THREE.DoubleSide });
    for (const cx of [-4, 4]) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.5), awn);
      a.position.set(cx, 2.42, 1.62);
      a.rotation.x = -Math.PI / 2 + 0.55;
      a.castShadow = true;
      front.add(a);
    }
    this.walls.push({ full: front, px: 0, pz: 0.9, nx: 0, nz: -1 });

    // interior partitions
    const pH = 3.2;
    this.wall(-7, -6, -4.5, -6, pH, paint, [0, 1], 0.16);
    this.wall(-3, -6, 3.5, -6, pH, paint, [0, 1], 0.16);
    this.wall(5, -6, 7, -6, pH, paint, [0, 1], 0.16);
    this.wall(1.5, -13, 1.5, -6, pH, paint, [1, 0], 0.16);
    const headers = new THREE.Group();
    this.scene.add(headers);
    this.box(1.5, pH - 2.4, 0.16, paint, -3.75, 2.4, -6, headers);
    this.box(1.5, pH - 2.4, 0.16, paint, 4.25, 2.4, -6, headers);
    const swing = mat('#9aa3aa', 0.35, 0.6);
    this.box(0.7, 1.3, 0.04, swing, -4.12, 0.5, -6.25, headers).rotation.y = 0.9;
    this.box(0.7, 1.3, 0.04, swing, -3.38, 0.5, -6.25, headers).rotation.y = -0.9;
    this.walls.push({ full: headers, px: 0, pz: -6, nx: 0, nz: 1 });

    // ceiling (seen from inside in first person; hidden with the roof in the cutaway)
    const ceil = new THREE.Group();
    this.scene.add(ceil);
    const ceilM = new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.95, side: THREE.DoubleSide });
    const c = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), ceilM);
    c.rotation.x = Math.PI / 2;
    c.position.set(0, H - 0.02, -6);
    ceil.add(c);
    for (const [x, z] of [[-3.5, -2.5], [3.5, -2.5], [-3, -9.5], [4.2, -9.5], [0, -0.5]]) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 16), this.bulbMat);
      lamp.position.set(x, H - 0.05, z);
      ceil.add(lamp);
    }
    if (o.business === 'restaurant' || o.business === 'coffee' || o.business === 'bakery') {
      for (const [x, z] of [[2.4, -4.3], [4.8, -4.3], [2.4, -1.8], [4.8, -1.8]]) {
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0, 4), mat('#222', 0.5));
        cord.position.set(x, H - 0.5, z);
        ceil.add(cord);
        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.25, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }));
        shade.position.set(x, H - 1.1, z);
        ceil.add(shade);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), this.bulbMat);
        bulb.position.set(x, H - 1.18, z);
        ceil.add(bulb);
      }
    }
    this.ceiling.push(ceil);

    // roof / upper floors
    const roof = new THREE.Group();
    this.scene.add(roof);
    this.box(14.4, 0.3, 14.4, mat('#5f5b56', 0.95), 0, H, -6, roof);
    if (this.floors > 0) {
      const upH = this.floors * 3.1;
      const up = new THREE.Mesh(uvBox(14.2, upH, 14.2, fScale), facadeMat);
      up.position.set(0, H + 0.3 + upH / 2, -6);
      up.castShadow = up.receiveShadow = true;
      roof.add(up);
      const wtrim = mat('#e9e3d6', 0.6);
      for (let fl = 0; fl < this.floors; fl++) {
        for (let k = 0; k < 4; k++) {
          const x = -5.1 + k * 3.4;
          const lit = (k + fl) % 3 === 0;
          const y = H + 0.95 + fl * 3.1;
          this.box(1.3, 1.65, 0.04, lit ? this.windowLit : this.windowDark, x, y, 1.11, roof, false);
          this.box(1.5, 0.08, 0.1, wtrim, x, y + 1.65, 1.14, roof, false);
          this.box(1.55, 0.07, 0.18, wtrim, x, y - 0.07, 1.16, roof, false);
          this.box(0.07, 1.65, 0.08, wtrim, x - 0.68, y, 1.13, roof, false);
          this.box(0.07, 1.65, 0.08, wtrim, x + 0.68, y, 1.13, roof, false);
        }
      }
      this.box(14.6, 0.35, 14.6, mat('#e9e3d6', 0.6), 0, H + 0.3 + upH, -6, roof);
    } else {
      const par = new THREE.Mesh(uvBox(14.4, 0.6, 0.25, fScale), facadeMat);
      par.position.set(0, H + 0.6, 1.08);
      roof.add(par);
      this.box(2.2, 1.0, 1.6, mat('#a4a8ab', 0.45, 0.5), 3.5, H + 0.3, -9, roof);
    }
    this.roofParts.push(roof);

    this.buildFrontOfHouse(trim);
    this.buildBackOfHouse();
    this.buildOffice();

    // warm interior lights
    for (const [x, z, on] of [[-1, -2.8, 1], [4.2, -9.5, 1]]) {
      const l = new THREE.PointLight('#ffd8a8', 0, 12, 1.5);
      l.visible = !!on;
      l.position.set(x, 3.0, z);
      this.scene.add(l);
      this.interiorLights.push(l);
    }

    // alleys either side of the shop
    for (const ax of [-8, 8]) {
      this.box(2, 2.6, 0.3, M.brick('#7a4c3c'), ax, 0, 0.6);
      this.collider(ax - 1, -14.5, ax + 1, 0.75);
      this.box(1.6, 1.1, 0.9, mat('#3f6b4f', 0.55, 0.3), ax, 0, -0.3);
    }

    this.anchors.door = { x: 0, z: 1.4, r: 1.2 };
    this.spots.street.push({ x: -4.2, z: 3.25, h: 0 }, { x: 4.2, z: 3.25, h: 0 }, { x: -2.4, z: 3.35, h: 0 }, { x: 2.4, z: 3.35, h: 0 });
    this.spots.inside.push({ x: 0.3, z: -1.6, h: Math.PI }, { x: -0.8, z: -4.8, h: 0.4 }, { x: 0.6, z: -3.4, h: -0.6 }, { x: -1.3, z: -0.5, h: 2.6 });
    this.spots.back.push({ x: -0.8, z: -8.0, h: 2.4 }, { x: -5.3, z: -10.0, h: Math.PI }, { x: -0.7, z: -10.9, h: -2.2 }, { x: -4.6, z: -7.4, h: 2.8 });
    this.spots.office.push({ x: 2.5, z: -8.0, h: 2.6 }, { x: 6.1, z: -7.5, h: -2.6 }, { x: 2.4, z: -11.2, h: 1.6 }, { x: 6.2, z: -12.0, h: -1.2 });
  }

  /** The storefront across the street: for lease until a rival moves in. */
  private buildRivalFront() {
    const trim = mat('#2c2a28', 0.6);
    this.box(13, 0.5, 0.2, trim, 0, 0, 14.9);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(12.6, 2.2, 0.05), this.glass);
    glass.position.set(0, 1.6, 14.92);
    this.scene.add(glass);
    for (let x = -6.3; x <= 6.31; x += 2.1) this.box(0.09, 2.3, 0.1, trim, x, 0.5, 14.92);
    this.box(13.4, 0.9, 0.14, trim, 0, 2.75, 14.93);
    this.rivalInterior = new THREE.Group();
    this.scene.add(this.rivalInterior);
    this.box(13.4, 0.02, 3, mat('#d9cfbf', 0.8), 0, 0.01, 16.6, this.rivalInterior, false);
    const rivalTable = mat('#3a3a3a', 0.5);
    for (const x of [-4, 0, 4]) this.box(1.2, 0.9, 0.7, rivalTable, x, 0, 16.5, this.rivalInterior);
    this.rivalSign = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.66), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
    this.rivalSign.position.set(0, 3.2, 14.84);
    this.rivalSign.rotation.y = Math.PI;
    this.scene.add(this.rivalSign);
    this.rivalLease = new THREE.Group();
    this.scene.add(this.rivalLease);
    const lease = new THREE.MeshStandardMaterial({ map: paperTexture('FOR LEASE', 'Call 555-0142'), roughness: 0.9 });
    for (const x of [-3.5, 3.5]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), lease);
      p.position.set(x, 1.6, 14.88);
      p.rotation.y = Math.PI;
      this.rivalLease.add(p);
    }
    this.anchors.rival = { x: 0, z: 13.4, r: 2.0, mesh: glass };
    this.clickables.push(glass);
    this.setRival(null);
  }

  readonly HOMES = HOMES;

  private buildFrontOfHouse(trim: THREE.Material) {
    const o = this.opts;
    const b = o.business;
    const wood = mat(b === 'convenience' ? '#e8e9ea' : b === 'barber' ? '#2b2b2e' : '#6b4a33', 0.7);
    const top = mat(b === 'convenience' ? '#cfd3d6' : b === 'barber' ? '#d8d2c6' : '#d8c7a6', 0.5);

    // counter
    if (b === 'bakery') {
      this.solid(4.2, 0.55, 0.8, wood, -4.5, -4.0);
      const caseGlass = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.55, 0.75), this.glass);
      caseGlass.position.set(-4.5, 0.55 + 0.275, -4.0);
      this.scene.add(caseGlass);
      this.box(4.2, 0.05, 0.8, top, -4.5, 1.1, -4.0);
      const pastry = ['#d9a066', '#c47b3e', '#f0d7a8', '#8b4a2b', '#e8b86a', '#f3e2c4'];
      for (let i = 0; i < 14; i++) {
        const m = mat(pastry[i % pastry.length], 0.7);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), m);
        p.scale.y = 0.6;
        p.position.set(-6.3 + (i % 7) * 0.55, 0.62 + Math.floor(i / 7) * 0.25, -4.0 + (i % 2) * 0.15);
        this.scene.add(p);
      }
    } else {
      this.solid(4.2, 1.0, 0.8, wood, -4.5, -4.0);
      this.box(4.36, 0.07, 0.92, top, -4.5, 1.0, -4.0);
    }
    // register
    this.box(0.45, 0.22, 0.38, mat('#2c2f33', 0.4, 0.3), -2.95, 1.07, -4.05);
    const screen = this.box(0.36, 0.26, 0.04, mat('#1b2836', 0.2, 0.2), -2.95, 1.3, -4.2);
    (screen.material as THREE.MeshStandardMaterial) = new THREE.MeshStandardMaterial({ color: '#2a4a63', emissive: '#4f8fc0', emissiveIntensity: 0.5 });
    this.anchors.register = { x: -2.7, z: -3.6, r: 1.25, mesh: screen };
    this.clickables.push(screen);
    // back shelving + menu board
    const shelf = mat('#7a5a40', 0.8);
    this.solid(4.2, 1.8, 0.4, shelf, -4.5, -5.7);
    const goods = ['#c9463d', '#e0b04a', '#4a8bc9', '#59a36b', '#e7e2d6', '#8a5a3a', '#d77b4a'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) {
      this.box(0.3, 0.32, 0.25, goods[(i * 3 + r) % goods.length], -6.3 + i * 0.45, 0.25 + r * 0.55, -5.62, this.scene, false);
    }
    this.menuBoard = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }));
    this.menuBoard.position.set(-4.5, 2.65, -5.88);
    this.scene.add(this.menuBoard);
    this.anchors.menu = { x: -4.6, z: -2.9, r: 1.0, mesh: this.menuBoard };
    this.clickables.push(this.menuBoard);
    if (b === 'coffee') {
      const esp = this.box(0.7, 0.5, 0.45, mat('#b9bdc1', 0.25, 0.8), -5.6, 1.07, -4.05);
      this.box(0.2, 0.08, 0.2, '#1e1e1e', -5.6, 1.57, -4.05, this.scene, false);
      void esp;
    }

    // staff + queue
    this.staffSpots.push({ x: -5.6, z: -4.95, h: 0 }, { x: -4.2, z: -4.95, h: 0 }, { x: -3.0, z: -4.95, h: 0 });
    for (let k = 0; k < 4; k++) this.queue.push({ x: -2.95, z: -3.0 + k * 0.8 });

    const seatAt = (x: number, z: number, h: number, y = 0.47, sit = true) => {
      const ax = x + Math.sin(h) * -0.7, az = z + Math.cos(h) * -0.7;
      this.seats.push({ x, z, h, y, sit, taken: false, approach: { x: ax, z: az } });
    };
    const chair = (x: number, z: number, h: number, color: string) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = h;
      this.scene.add(g);
      const m = mat(color, 0.7);
      this.box(0.46, 0.06, 0.46, m, 0, 0.44, 0, g);
      this.box(0.46, 0.5, 0.06, m, 0, 0.48, -0.22, g);
      for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) this.box(0.05, 0.44, 0.05, m, lx, 0, lz, g, false);
    };

    if (b === 'restaurant' || b === 'bakery' || b === 'coffee') {
      const tables: [number, number][] = b === 'restaurant'
        ? [[2.4, -4.3], [5.3, -4.3], [2.4, -1.6], [5.3, -1.6]]
        : b === 'bakery' ? [[2.6, -4.2], [5.2, -4.2], [3.9, -1.5]]
        : [[2.2, -4.4], [4.6, -4.4], [2.2, -2.0], [4.6, -2.0]];
      const cloth = mat(b === 'restaurant' ? '#f4efe6' : '#e9e3d8', 0.9);
      for (const [x, z] of tables) {
        if (b === 'restaurant') {
          this.solid(1.0, 0.74, 1.0, mat('#5a3b2b', 0.7), x, z);
          this.box(1.1, 0.04, 1.1, cloth, x, 0.74, z);
          this.cyl(0.04, 0.05, 0.22, mat(o.accent, 0.5), x, 0.78, z);
        } else {
          this.collider(x - 0.4, z - 0.4, x + 0.4, z + 0.4);
          this.cyl(0.45, 0.45, 0.05, top, x, 0.72, z);
          this.cyl(0.06, 0.08, 0.72, mat('#2c2c2c', 0.5, 0.4), x, 0, z, this.scene, 10);
          this.cyl(0.05, 0.04, 0.1, '#f2efe8', x + 0.12, 0.77, z, this.scene, 10);
        }
        const chairColor = b === 'restaurant' ? '#6b4a33' : b === 'coffee' ? '#3c3c3c' : '#c9a27a';
        chair(x - 0.78, z, Math.PI / 2, chairColor);
        chair(x + 0.78, z, -Math.PI / 2, chairColor);
        seatAt(x - 0.72, z, Math.PI / 2);
        seatAt(x + 0.72, z, -Math.PI / 2);
      }
      if (b === 'coffee') {
        // sofa along the right wall
        const sofa = mat('#8a4f3a', 0.95);
        this.solid(0.8, 0.45, 2.6, sofa, 6.35, -0.9);
        this.box(0.25, 0.85, 2.6, sofa, 6.65, 0, -0.9);
        seatAt(6.2, -1.5, -Math.PI / 2, 0.5);
        seatAt(6.2, -0.3, -Math.PI / 2, 0.5);
      }
    } else if (b === 'convenience') {
      const shelfM = mat('#dfe3e6', 0.6, 0.2);
      const prod = ['#d94a3a', '#f0c23c', '#3d8fd6', '#4caf6a', '#ffffff', '#ff8a3d', '#8a4fbf', '#2b2b2b'];
      for (const x of [2.0, 4.0]) {
        this.solid(0.7, 1.55, 3.6, shelfM, x, -3.2);
        for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) for (const sx of [-0.36, 0.36]) {
          this.box(0.08, 0.3, 0.4, prod[(k + r * 2 + (sx > 0 ? 3 : 0)) % prod.length], x + sx, 0.2 + r * 0.48, -4.7 + k * 0.5, this.scene, false);
        }
      }
      // fridge wall
      const fridge = new THREE.MeshStandardMaterial({ color: '#dbe9f2', emissive: '#bfe3ff', emissiveIntensity: 0.35, roughness: 0.2 });
      this.solid(0.6, 2.2, 5.0, mat('#cfd5da', 0.5, 0.3), 6.6, -3.0);
      this.box(0.04, 1.9, 4.8, fridge, 6.28, 0.15, -3.0, this.scene, false);
      for (const z of [-4.7, -3.0, -1.3]) this.seats.push({ x: 5.6, z, h: Math.PI / 2, y: 0, sit: false, taken: false, approach: { x: 5.4, z } });
      for (const z of [-4.2, -2.4]) for (const x of [3.0, 1.0]) this.seats.push({ x, z, h: x === 3.0 ? Math.PI / 2 : -Math.PI / 2, y: 0, sit: false, taken: false, approach: { x, z } });
    } else if (b === 'barber') {
      const mirror = new THREE.MeshStandardMaterial({ color: '#d6e2ea', roughness: 0.05, metalness: 0.9 });
      for (const z of [-4.8, -2.9, -1.0]) {
        // chair
        const g = new THREE.Group();
        g.position.set(5.7, 0, z);
        g.rotation.y = Math.PI / 2;
        this.scene.add(g);
        this.cyl(0.25, 0.32, 0.4, mat('#9ea4a9', 0.3, 0.8), 0, 0, 0, g);
        this.box(0.62, 0.14, 0.62, mat('#7a1f24', 0.5), 0, 0.42, 0, g);
        this.box(0.62, 0.7, 0.12, mat('#7a1f24', 0.5), 0, 0.5, -0.3, g);
        this.collider(5.45, z - 0.3, 5.95, z + 0.3);
        this.box(0.04, 1.3, 1.1, mirror, 6.86, 1.0, z, this.scene, false);
        this.box(0.3, 0.06, 1.2, mat('#2b2b2e', 0.5), 6.75, 0.95, z);
        this.seats.push({ x: 5.7, z, h: Math.PI / 2, y: 0.56, sit: true, taken: false, approach: { x: 5.0, z } });
      }
      // barber pole outside
      const pole = new THREE.MeshStandardMaterial({ map: stripeTexture('#c8312e', '#f6f1e6', 6), roughness: 0.4 });
      pole.map!.rotation = 0.6;
      this.cyl(0.12, 0.12, 0.9, pole, 1.4, 1.2, 1.15);
      // waiting bench
      this.solid(2.6, 0.45, 0.55, mat('#3b3b3f', 0.6), 3.0, 0.2);
      this.seats.push({ x: 2.4, z: 0.2, h: Math.PI, y: 0.48, sit: true, taken: false, approach: { x: 2.4, z: -0.5 } });
      this.seats.push({ x: 3.6, z: 0.2, h: Math.PI, y: 0.48, sit: true, taken: false, approach: { x: 3.6, z: -0.5 } });
    }

    // a few plants and a rug
    const pot = mat('#b4673f', 0.8);
    const leaf = new THREE.MeshStandardMaterial({ color: '#4f8a4a', roughness: 0.9, flatShading: true });
    for (const [x, z] of [[-6.4, 0.2], [6.4, 0.25]]) {
      if (b === 'barber' && x > 0) continue;
      this.cyl(0.22, 0.17, 0.42, pot, x, 0, z);
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), leaf);
      bush.position.set(x, 0.8, z);
      bush.castShadow = true;
      this.scene.add(bush);
      this.collider(x - 0.25, z - 0.25, x + 0.25, z + 0.25);
    }
    void trim;
  }

  private buildBackOfHouse() {
    const b = this.opts.business;
    const steel = mat('#b3b9bf', 0.35, 0.6);
    this.solid(8.0, 0.92, 0.7, steel, -2.8, -12.5);
    // stove / oven / machine against the back wall
    if (b === 'restaurant' || b === 'coffee') {
      this.box(1.4, 0.95, 0.72, mat('#2d3034', 0.5, 0.4), -5.6, 0, -12.5);
      for (const [dx, dz] of [[-0.35, -0.15], [0.35, -0.15], [-0.35, 0.15], [0.35, 0.15]]) this.cyl(0.14, 0.14, 0.03, '#141414', -5.6 + dx, 0.95, -12.5 + dz, this.scene, 12);
      this.box(1.6, 0.6, 0.9, steel, -5.6, 2.3, -12.45);
      this.cyl(0.18, 0.2, 0.3, mat('#9aa0a6', 0.3, 0.8), -5.25, 0.98, -12.4, this.scene, 12);
    } else if (b === 'bakery') {
      this.box(2.0, 1.9, 0.9, mat('#3a3b3e', 0.5, 0.4), -5.5, 0, -12.4);
      for (const y of [0.5, 1.1]) this.box(1.6, 0.36, 0.05, new THREE.MeshStandardMaterial({ color: '#ff9a4a', emissive: '#ff7a2a', emissiveIntensity: 0.8 }), -5.5, y, -11.94, this.scene, false);
    } else if (b === 'barber') {
      this.box(0.8, 0.9, 0.7, mat('#eeeeee', 0.4), -5.8, 0, -12.5);
      this.box(0.8, 0.9, 0.7, mat('#eeeeee', 0.4), -4.9, 0, -12.5);
    }
    // sink
    this.box(1.0, 0.06, 0.55, mat('#6f767c', 0.2, 0.7), -1.8, 0.89, -12.45, this.scene, false);
    const tap = this.cyl(0.03, 0.03, 0.35, mat('#c9cdd2', 0.2, 0.9), -1.8, 0.92, -12.72);
    this.anchors.sink = { x: -1.8, z: -11.6, r: 1.25, mesh: tap };
    this.clickables.push(tap);
    // prep island
    const prep = this.solid(1.9, 0.92, 0.95, steel, -3.0, -9.3);
    this.box(0.5, 0.04, 0.35, mat('#c99a63', 0.7), -3.4, 0.92, -9.3);
    this.box(0.35, 0.18, 0.35, mat('#e6e2d8', 0.6), -2.6, 0.92, -9.2);
    this.anchors.prep = { x: -3.0, z: -9.3, r: 1.6, mesh: prep };
    this.clickables.push(prep);
    // shelving with stock
    const rack = mat('#8d949a', 0.5, 0.5);
    this.solid(0.5, 2.1, 4.0, rack, -6.65, -9.0);
    const box = ['#c8a77a', '#b8946a', '#d4b98e', '#a98a63'];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) this.box(0.38, 0.32, 0.5, box[(r + k) % 4], -6.62, 0.1 + r * 0.52, -10.6 + k * 0.62, this.scene, false);
    // fridge
    this.solid(1.1, 2.1, 0.8, mat('#d9dde0', 0.3, 0.4), 0.7, -6.7);
    this.backStaffSpots.push({ x: -3.0, z: -10.4, h: 0 }, { x: -5.0, z: -11.6, h: Math.PI });
  }

  private buildOffice() {
    const wood = mat('#7a5638', 0.6);
    const desk = this.solid(2.0, 0.76, 0.85, wood, 4.4, -10.6);
    this.box(0.7, 0.45, 0.05, mat('#1f2328', 0.3), 4.4, 0.8, -10.35);
    const mon = this.box(0.62, 0.36, 0.02, new THREE.MeshStandardMaterial({ color: '#203040', emissive: '#3d7bb0', emissiveIntensity: 0.6 }), 4.4, 0.86, -10.39);
    mon.rotation.y = Math.PI;
    this.box(0.5, 0.03, 0.18, '#2a2a2a', 4.4, 0.77, -10.75, this.scene, false);
    this.anchors.desk = { x: 4.4, z: -11.3, r: 1.3, mesh: desk };
    this.clickables.push(desk);
    // owner chair
    this.cyl(0.26, 0.26, 0.1, '#2c2c30', 4.4, 0.42, -11.55);
    this.box(0.5, 0.6, 0.08, mat('#2c2c30', 0.6), 4.4, 0.5, -11.85);
    // Priya's chair
    this.cyl(0.24, 0.24, 0.08, mat('#3a6670', 0.8), 4.4, 0.42, -9.45);
    this.anchors.priya = { x: 4.4, z: -9.4, r: 1.3 };
    // filing cabinets, bookshelf, safe, plant, window
    this.solid(0.6, 1.3, 1.2, mat('#7c8a93', 0.5, 0.4), 6.6, -12.3);
    this.solid(0.4, 2.0, 2.2, wood, 6.75, -9.0);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
      this.box(0.25, 0.32, 0.1, ['#9b3d3d', '#3b5f8c', '#d1c4a8', '#3f7a5a'][(r + k) % 4], 6.65, 0.15 + r * 0.48, -9.9 + k * 0.33, this.scene, false);
    }
    this.solid(0.6, 0.7, 0.6, mat('#3a3d42', 0.4, 0.7), 2.1, -12.4);
    const leaf = new THREE.MeshStandardMaterial({ color: '#4f8a4a', roughness: 0.9, flatShading: true });
    this.cyl(0.2, 0.15, 0.4, mat('#b4673f', 0.8), 2.1, 0, -6.6);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), leaf);
    bush.position.set(2.1, 0.75, -6.6);
    this.scene.add(bush);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2), new THREE.MeshStandardMaterial({ color: '#8fb8d6', emissive: '#6f9fc4', emissiveIntensity: 0.25, roughness: 0.2 }));
    win.position.set(4.4, 1.9, -12.84);
    this.scene.add(win);
    const frame = mat('#f4f1ea', 0.6);
    this.box(2.4, 0.1, 0.06, frame, 4.4, 1.25, -12.83, this.scene, false);
    this.box(2.4, 0.1, 0.06, frame, 4.4, 2.5, -12.83, this.scene, false);
    this.box(0.08, 1.3, 0.06, frame, 4.4, 1.25, -12.82, this.scene, false);
    this.box(0.1, 1.35, 0.06, frame, 3.2, 1.22, -12.83, this.scene, false);
    this.box(0.1, 1.35, 0.06, frame, 5.6, 1.22, -12.83, this.scene, false);
    // a framed first dollar
    this.box(0.5, 0.36, 0.03, mat('#2b2b2b', 0.5), 2.8, 1.8, -12.84, this.scene, false);
    this.box(0.4, 0.26, 0.02, mat('#8fb38a', 0.8), 2.8, 1.85, -12.82, this.scene, false);
  }

  // ---------- dynamic look ----------
  setRival(name: string | null) {
    const m = this.rivalSign.material as THREE.MeshStandardMaterial;
    m.map?.dispose();
    m.map = name ? signTexture(name, '#3a1f22', '#f2d7a0', { sub: 'Now open' }) : signTexture('', '#2c2a28', '#2c2a28');
    m.needsUpdate = true;
    this.rivalLease.visible = !name;
    this.rivalInterior.visible = !!name;
  }

  setMenu(heading: string, lines: { name: string; price: string; isNew: boolean }[], note: string) {
    const m = this.menuBoard.material as THREE.MeshStandardMaterial;
    m.map?.dispose();
    m.map = menuBoardTexture(heading, lines, note, this.opts.accent === '#3d9be9' ? '#7cc4ff' : '#f2c86b');
    m.needsUpdate = true;
  }

  setRenovating(on: boolean) {
    this.renoProps.clear();
    if (!on) return;
    const cone = mat('#ff7a2a', 0.6);
    for (const x of [-5.5, -3, 3, 5.5]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 14), cone);
      c.position.set(x, 0.3, 3.3);
      c.castShadow = true;
      this.renoProps.add(c);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshStandardMaterial({ map: paperTexture('PARDON', 'our dust · reno'), roughness: 0.9 }));
    sign.position.set(-2.2, 1.2, 3.0);
    this.renoProps.add(sign);
    this.box(0.08, 0.8, 0.08, '#6b4a33', -2.2, 0, 2.98, this.renoProps);
  }

  /** calendar month 1-12 */
  setSeason(cal: number) {
    const season = cal === 12 || cal <= 2 ? 'winter' : cal <= 5 ? 'spring' : cal <= 8 ? 'summer' : 'autumn';
    const cols: Record<string, string[]> = {
      spring: ['#6aa04e', '#86b45a', '#d99ab0'],
      summer: ['#4f8a3c', '#5f9a45', '#467d36'],
      autumn: ['#c9772f', '#b8452c', '#d9a23a'],
      winter: ['#8c9a8c', '#a7b2ab', '#7f8a83'],
    };
    this.foliage.forEach((m, i) => m.color.set(cols[season][i % 3]));
    this.hedgeMat.color.set(season === 'winter' ? '#6f7f6a' : season === 'autumn' ? '#6b7a3a' : '#4d7a3f');
    M.grass().color.set(season === 'winter' ? '#d9dfe0' : season === 'autumn' ? '#c9b98a' : '#ffffff');
    this.skyMat.uniforms.cover.value = season === 'winter' ? 0.62 : season === 'autumn' ? 0.5 : 0.4;
    if (this.snow) { this.snow.removeFromParent(); this.snow = null; }
    if (season === 'winter') {
      const n = 2200;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 70;
        pos[i * 3 + 1] = Math.random() * 20;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.07, transparent: true, opacity: 0.85, depthWrite: false }));
      this.snow.frustumCulled = false;
      this.scene.add(this.snow);
    }
  }

  /** 0 = 8am, 1 = dusk */
  setTime(t: number) {
    this.t = t;
    const keys = [
      { t: 0, top: '#7fb0e2', bottom: '#f2e2cf', sun: '#ffd9ae', si: 2.6, hemi: 0.35, el: 0.38, az: 1.05, env: 0.85 },
      { t: 0.45, top: '#4f8fd8', bottom: '#d9e7f1', sun: '#fff4e4', si: 3.4, hemi: 0.4, el: 0.95, az: 0.15, env: 1.0 },
      { t: 0.8, top: '#6787bf', bottom: '#f0c49a', sun: '#ffc08a', si: 2.6, hemi: 0.32, el: 0.42, az: -0.75, env: 0.85 },
      { t: 1, top: '#1f2d55', bottom: '#e48f62', sun: '#ff8c52', si: 1.3, hemi: 0.18, el: 0.12, az: -1.1, env: 0.55 },
    ];
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const a = keys[i], b = keys[i + 1];
    const k = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
    const lerp = (x: number, y: number) => x + (y - x) * k;
    const col = (x: string, y: string) => new THREE.Color(x).lerp(new THREE.Color(y), k);
    const U = this.skyMat.uniforms;
    U.top.value.copy(col(a.top, b.top));
    U.bottom.value.copy(col(a.bottom, b.bottom));
    U.sunColor.value.copy(col(a.sun, b.sun));
    (this.scene.fog as THREE.Fog).color.copy(col(a.bottom, b.bottom)).lerp(col(a.top, b.top), 0.2);
    this.sun.color.copy(col(a.sun, b.sun));
    this.sun.intensity = lerp(a.si, b.si);
    this.hemi.intensity = lerp(a.hemi, b.hemi);
    this.sunEl = lerp(a.el, b.el);
    this.sunAz = lerp(a.az, b.az);
    U.sunDir.value.set(Math.sin(this.sunAz) * Math.cos(this.sunEl), Math.sin(this.sunEl), Math.cos(this.sunAz) * Math.cos(this.sunEl)).normalize();
    if (this.envMaps.length) {
      let best = this.envMaps[0];
      for (const e of this.envMaps) if (Math.abs(e.t - t) < Math.abs(best.t - t)) best = e;
      this.scene.environment = best.tex;
    }
    this.envIntensity = lerp(a.env, b.env);
    const night = Math.max(0, (t - 0.72) / 0.28);
    this.bulbMat.emissiveIntensity = 0.4 + night * 2.6;
    this.windowLit.emissiveIntensity = night * 1.5;
    this.shopGlassOut.emissiveIntensity = night * 0.35;
    for (const l of this.streetLights) l.intensity = night * 30;
    for (const l of this.interiorLights) l.intensity = (this.firstPerson ? 7 : 3) + night * 8;
    if (this.userSign) this.userSign.emissiveIntensity = night * 0.6;
    for (const m of this.signMats) m.emissiveIntensity = night * 0.45;
  }
  private sunEl = 1;
  private sunAz = 0;
  envIntensity = 1;

  /** traffic signal state from the controller */
  setSignals(main: 'g' | 'y' | 'r', oak: 'g' | 'y' | 'r') {
    for (const s of this.signals) {
      const st = s.axis === 'main' ? main : oak;
      s.r.emissiveIntensity = st === 'r' ? 3 : 0.04;
      s.y.emissiveIntensity = st === 'y' ? 3 : 0.04;
      s.g.emissiveIntensity = st === 'g' ? 3 : 0.04;
    }
  }

  /** Per-frame: sun follows the focus, walls cut away when you're inside (third person). */
  update(dt: number, focus: THREE.Vector3, camPos: THREE.Vector3, playerInside: boolean, playerPos: THREE.Vector3) {
    this.clock += dt;
    const d = 60;
    this.sun.position.set(
      focus.x + Math.sin(this.sunAz) * Math.cos(this.sunEl) * d,
      Math.sin(this.sunEl) * d,
      focus.z + Math.cos(this.sunAz) * Math.cos(this.sunEl) * d,
    );
    this.sun.target.position.copy(focus);
    this.sky.position.copy(camPos);
    this.skyMat.uniforms.time.value = this.clock;

    const cut = playerInside && !this.firstPerson;
    if (cut !== this.cutaway) {
      this.cutaway = cut;
      for (const r of this.roofParts) r.visible = !cut;
      for (const r of this.ceiling) r.visible = !cut;
    }
    for (const w of this.walls) {
      let c = false;
      if (cut) {
        const sc = (camPos.x - w.px) * w.nx + (camPos.z - w.pz) * w.nz;
        const sp = (playerPos.x - w.px) * w.nx + (playerPos.z - w.pz) * w.nz;
        c = Math.sign(sc) !== Math.sign(sp);
      }
      w.full.visible = !c;
      if (w.short) w.short.visible = c;
    }
    if (this.snow) {
      const p = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - dt * 1.3;
        if (y < 0) y += 20;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(y + i) * dt * 0.2);
      }
      p.needsUpdate = true;
      this.snow.position.set(focus.x, 0, focus.z);
    }
    // tree crowns between the camera and the player step aside
    const sx = focus.x - camPos.x, sy = focus.y - camPos.y, sz = focus.z - camPos.z;
    const sl = sx * sx + sy * sy + sz * sz || 1;
    for (const c of this.crowns) {
      if (this.firstPerson) { c.g.visible = true; continue; }
      const t = Math.max(0, Math.min(1, ((c.x - camPos.x) * sx + (c.y - camPos.y) * sy + (c.z - camPos.z) * sz) / sl));
      const dx = camPos.x + sx * t - c.x, dy = camPos.y + sy * t - c.y, dz = camPos.z + sz * t - c.z;
      c.g.visible = !(t < 0.92 && dx * dx + dy * dy + dz * dz < c.r * c.r);
    }
    for (const f of this.flags) {
      f.rotation.y = Math.sin(this.clock * 2.1) * 0.25;
    }
  }
}

function groupOf(a: THREE.Object3D, b: THREE.Object3D) {
  const g = new THREE.Group();
  a.parent?.add(g);
  g.add(a, b);
  return g;
}
