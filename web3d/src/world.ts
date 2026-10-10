// The block: your shop (floor, back of house, office), the bank, Marcus's gym,
// the rival storefront across the street, a market square, traffic lanes.
// Everything here is static scenery plus the anchors gameplay hangs off.
import * as THREE from 'three';
import type { BusinessId, LocationId, Venue } from '../../src/game/types';
import { Box, NavGrid, P2 } from './nav';
import { mat } from './people';
import { batch } from './batch';
import {
  brickTexture, menuBoardTexture, noiseTexture, paperTexture, planksTexture, signTexture,
  skyMaterial, stripeTexture, tileTexture,
} from './textures';

export interface Spot { x: number; z: number; h: number }
export interface Seat extends Spot { y: number; sit: boolean; taken: boolean; approach: P2 }
export interface WallSeg { full: THREE.Object3D; short?: THREE.Object3D; px: number; pz: number; nx: number; nz: number }
export interface Anchor { x: number; z: number; r: number; mesh?: THREE.Object3D }

export const SHOP = { x0: -7, x1: 7, z0: -13, z1: 1 };
export const BOUNDS = { x0: -24, x1: 26, z0: -13.6, z1: 27.6 };
export const ROAD = { z0: 4, z1: 12 };

export function groundY(x: number, z: number) {
  return z > ROAD.z0 + 0.15 && z < ROAD.z1 - 0.15 ? -0.12 : 0;
}

export function insideShop(x: number, z: number) {
  return x > SHOP.x0 && x < SHOP.x1 && z > SHOP.z0 && z < SHOP.z1 - 0.15;
}

export function roomOf(x: number, z: number): Venue | 'bank' | 'outside' {
  if (!insideShop(x, z)) return z < 4 ? 'street' : 'outside';
  if (z > -6) return 'inside';
  return x < 1.5 ? 'back' : 'office';
}

const FACADE: Record<BusinessId, { wall: string; trim: string; paint: string; wainscot: string }> = {
  restaurant: { wall: '#8c4a3b', trim: '#2d2a26', paint: '#efe3d3', wainscot: '#5a3b2b' },
  coffee: { wall: '#2f4a3f', trim: '#c9b48a', paint: '#ebe4d8', wainscot: '#2f4a3f' },
  bakery: { wall: '#e8d6b8', trim: '#8a5a3a', paint: '#f7eddd', wainscot: '#d9b89a' },
  convenience: { wall: '#e3e6e8', trim: '#2c5d9c', paint: '#f4f5f3', wainscot: '#c8ced4' },
  barber: { wall: '#27334a', trim: '#c8a24a', paint: '#ece7df', wainscot: '#27334a' },
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
  readonly nav: NavGrid;
  readonly walls: WallSeg[] = [];
  readonly roofParts: THREE.Object3D[] = [];
  readonly clickables: THREE.Object3D[] = [];
  readonly anchors: Record<string, Anchor> = {};
  readonly spots: Record<Venue, Spot[]> = { street: [], inside: [], back: [], office: [] };
  readonly seats: Seat[] = [];
  readonly queue: P2[] = [];
  readonly staffSpots: Spot[] = [];
  readonly backStaffSpots: Spot[] = [];
  readonly door = { out: { x: 0, z: 2.2 }, in: { x: 0, z: -0.4 } };
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private interiorLights: THREE.PointLight[] = [];
  private streetLights: THREE.PointLight[] = [];
  private bulbMat = new THREE.MeshStandardMaterial({ color: '#fff2d0', emissive: '#ffcc80', emissiveIntensity: 0 });
  private windowLit = new THREE.MeshStandardMaterial({ color: '#7d97ad', roughness: 0.3, metalness: 0, emissive: '#ffc77a', emissiveIntensity: 0 });
  private windowDark = new THREE.MeshStandardMaterial({ color: '#6a849b', roughness: 0.3, metalness: 0 });
  private glass = new THREE.MeshStandardMaterial({ color: '#b8d4e3', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false });
  private foliage: THREE.MeshStandardMaterial[] = [];
  private grassMat: THREE.MeshStandardMaterial;
  private snow: THREE.Points | null = null;
  private rivalSign!: THREE.Mesh;
  private rivalLease!: THREE.Object3D;
  private rivalInterior!: THREE.Object3D;
  private menuBoard!: THREE.Mesh;
  private renoProps = new THREE.Group();
  private fountainWater: THREE.Mesh | null = null;
  readonly opts: WorldOpts;
  private floors: number;
  private t = 0;
  private cutaway = false;

  constructor(opts: WorldOpts) {
    this.opts = opts;
    this.floors = opts.location === 'low' ? 0 : opts.location === 'average' ? 1 : 3;
    const s = this.scene;
    s.fog = new THREE.Fog('#dfe7ec', 55, 150);

    this.skyMat = skyMaterial();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), this.skyMat);
    s.add(this.sky);

    this.hemi = new THREE.HemisphereLight('#cfe3ff', '#8c7b62', 1.1);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1dc', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 140;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    s.add(this.sun, this.sun.target);

    this.grassMat = new THREE.MeshStandardMaterial({ color: '#86a465', roughness: 1 });
    this.nav = new NavGrid(BOUNDS.x0, BOUNDS.z0, BOUNDS.x1, BOUNDS.z1, 0.3);

    this.buildGround();
    this.buildShop();
    this.buildNeighbours();
    this.buildSouthSide();
    this.buildPark();
    this.buildStreetFurniture();

    // invisible boundary
    this.collider(BOUNDS.x0 - 1, BOUNDS.z0 - 1, BOUNDS.x0, BOUNDS.z1 + 1);
    this.collider(BOUNDS.x1, BOUNDS.z0 - 1, BOUNDS.x1 + 1, BOUNDS.z1 + 1);
    this.collider(BOUNDS.x0, BOUNDS.z1, BOUNDS.x1, BOUNDS.z1 + 1);
    this.collider(BOUNDS.x0, BOUNDS.z0 - 1, BOUNDS.x1, BOUNDS.z0);
    for (const b of this.colliders) this.nav.addBox(b, 0.32);

    s.add(this.renoProps);
    // fold static scenery into a few big meshes; keep anything that toggles or gets clicked
    const keep = new Set<THREE.Object3D>([this.sky, this.renoProps, this.rivalInterior, this.rivalLease, this.rivalSign, this.menuBoard, ...this.roofParts, ...this.clickables]);
    for (const w of this.walls) { keep.add(w.full); if (w.short) keep.add(w.short); }
    batch(s, keep);
    for (const r of this.roofParts) if (!(r as THREE.Mesh).isMesh) batch(r);
    this.setTime(0);
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

  /** Solid furniture: a box that also blocks movement. */
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

  /** A wall segment along x or z with a cutaway stub. */
  wall(x0: number, z0: number, x1: number, z1: number, h: number, m: THREE.Material | string, inward: [number, number], t = 0.2) {
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = along ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const w = along ? len : t, d = along ? t : len;
    const full = this.box(w, h, d, m, cx, 0, cz);
    const short = this.box(w, 0.32, d, m, cx, 0, cz);
    short.visible = false;
    this.collider(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
    this.walls.push({ full, short, px: cx, pz: cz, nx: inward[0], nz: inward[1] });
    return full;
  }

  // ---------- ground & street ----------
  private buildGround() {
    const ground = this.plane(600, 600, this.grassMat, 0, -0.14, 0);
    ground.receiveShadow = true;
    // city blocks: paved
    const pave = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, map: noiseTexture('#c8c2b5', 14, [40, 6]) });
    this.box(160, 0.14, 50, pave, 0, -0.14, -24); // north block
    this.box(160, 0.14, 50, pave, 0, -0.14, 37); // south block
    // sidewalk slabs with joints
    const walk = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, map: tileTexture('#d4cec2', '#cdc6b9', 4, [40, 1]) });
    this.box(160, 0.14, 3, walk, 0, -0.14, 2.5);
    this.box(160, 0.14, 3, walk, 0, -0.14, 13.5);
    // curbs
    const curb = mat('#a9a49a', 0.8);
    this.box(160, 0.16, 0.2, curb, 0, -0.16, 3.95);
    this.box(160, 0.16, 0.2, curb, 0, -0.16, 12.05);
    // road
    const asphalt = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, map: noiseTexture('#43474d', 22, [30, 2]) });
    this.plane(160, 7.8, asphalt, 0, -0.12, 8);
    const paint = mat('#efe6c8', 0.6);
    for (let x = -78; x < 80; x += 6) this.box(3, 0.01, 0.15, paint, x, -0.115, 8, this.scene, false);
    // crosswalk
    const white = mat('#f1efe8', 0.6);
    for (let z = 4.6; z < 11.6; z += 0.9) this.box(2.4, 0.01, 0.5, white, 9, -0.115, z, this.scene, false);
  }

  // ---------- your shop ----------
  private buildShop() {
    const o = this.opts;
    const f = FACADE[o.business];
    const H = 3.4;
    const facadeMat = o.business === 'restaurant'
      ? new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, map: brickTexture(f.wall, [3, 1]) })
      : mat(f.wall, 0.85);
    const paint = mat(f.paint, 0.95);
    const trim = mat(f.trim, 0.6);

    // floors
    const floorTex = {
      restaurant: planksTexture('#8a5a3a', [3, 2]),
      coffee: planksTexture('#6f4a32', [3, 2]),
      bakery: tileTexture('#f1e3cf', '#e0c6a3', 8, [3, 1.5]),
      convenience: tileTexture('#eceeeb', '#dfe2de', 8, [3, 1.5]),
      barber: tileTexture('#f2f2ef', '#2a2a2a', 8, [3, 1.5]),
    }[o.business];
    this.plane(14, 7, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }), 0, 0.005, -2.5);
    this.plane(8.5, 7, new THREE.MeshStandardMaterial({ map: tileTexture('#c9ccc9', '#bec2bf', 8, [2, 2]), roughness: 0.6 }), -2.75, 0.005, -9.5);
    this.plane(5.5, 7, new THREE.MeshStandardMaterial({ map: noiseTexture('#5a6b78', 26, [3, 3]), roughness: 1 }), 4.25, 0.005, -9.5);

    // ---- exterior walls: an outer skin and an inner painted skin ----
    const side = (x: number, inward: number) => {
      this.wall(x, -13, x, 1, H, facadeMat, [inward, 0], 0.12);
      const inner = this.box(0.08, H - 0.05, 14, paint, x + inward * 0.1, 0, -6);
      this.walls[this.walls.length - 1].full = groupOf(this.walls[this.walls.length - 1].full, inner);
    };
    side(-7, 1);
    side(7, -1);
    this.wall(-7, -13, 7, -13, H, facadeMat, [0, 1], 0.12);
    const backInner = this.box(14, H - 0.05, 0.08, paint, 0, 0, -12.9);
    this.walls[this.walls.length - 1].full = groupOf(this.walls[this.walls.length - 1].full, backInner);
    // wainscot strip on the floor walls
    const wain = mat(f.wainscot, 0.8);
    this.box(0.04, 0.9, 7, wain, -6.84, 0, -2.5).userData.shopTrim = true;
    this.box(0.04, 0.9, 7, wain, 6.84, 0, -2.5).userData.shopTrim = true;

    // ---- storefront (front wall at z = 1) ----
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
    // door frame + open door leaf
    this.box(0.14, 2.75, 0.24, trim, -1.0, 0, 0.9, front);
    this.box(0.14, 2.75, 0.24, trim, 1.0, 0, 0.9, front);
    const leaf = new THREE.Group();
    leaf.position.set(-0.93, 0, 0.82);
    leaf.rotation.y = -1.35;
    this.box(0.9, 2.3, 0.05, this.glass, 0.45, 0.05, 0, leaf);
    this.box(0.9, 0.12, 0.07, trim, 0.45, 0.05, 0, leaf);
    this.box(0.9, 0.12, 0.07, trim, 0.45, 2.25, 0, leaf);
    front.add(leaf);
    // header band and sign
    this.box(14.2, H - 2.73, 0.26, facadeMat, 0, 2.73, 0.92, front);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.62), new THREE.MeshStandardMaterial({
      map: signTexture(o.shopName, o.accent, '#fffaf0', { sub: o.tagline }), roughness: 0.6,
      emissive: '#ffffff', emissiveIntensity: 0,
    }));
    sign.position.set(0, 3.06, 1.07);
    front.add(sign);
    (sign.material as THREE.MeshStandardMaterial).emissiveMap = (sign.material as THREE.MeshStandardMaterial).map;
    this.userSign = sign.material as THREE.MeshStandardMaterial;
    // awnings
    const awn = new THREE.MeshStandardMaterial({ map: stripeTexture(o.accent, '#f6f1e6', 10), roughness: 0.9, side: THREE.DoubleSide });
    for (const cx of [-4, 4]) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.5), awn);
      a.position.set(cx, 2.42, 1.62);
      a.rotation.x = -Math.PI / 2 + 0.55;
      a.castShadow = true;
      front.add(a);
    }
    this.walls.push({ full: front, px: 0, pz: 0.9, nx: 0, nz: -1 });

    // ---- interior partitions (z = -6 with two doorways, x = 1.5) ----
    const pH = 3.2;
    this.wall(-7, -6, -4.5, -6, pH, paint, [0, 1], 0.16);
    this.wall(-3, -6, 3.5, -6, pH, paint, [0, 1], 0.16);
    this.wall(5, -6, 7, -6, pH, paint, [0, 1], 0.16);
    this.wall(1.5, -13, 1.5, -6, pH, paint, [1, 0], 0.16);
    // door headers
    const headers = new THREE.Group();
    this.scene.add(headers);
    this.box(1.5, pH - 2.4, 0.16, paint, -3.75, 2.4, -6, headers);
    this.box(1.5, pH - 2.4, 0.16, paint, 4.25, 2.4, -6, headers);
    // kitchen swing doors (decorative)
    const swing = mat('#9aa3aa', 0.4, 0.5);
    this.box(0.7, 1.3, 0.04, swing, -4.12, 0.5, -6.25, headers).rotation.y = 0.9;
    this.box(0.7, 1.3, 0.04, swing, -3.38, 0.5, -6.25, headers).rotation.y = -0.9;
    this.walls.push({ full: headers, px: 0, pz: -6, nx: 0, nz: 1 });

    // ---- roof / upper floors ----
    const roof = new THREE.Group();
    this.scene.add(roof);
    this.box(14.4, 0.3, 14.4, mat('#6b6660', 0.9), 0, H, -6, roof);
    if (this.floors > 0) {
      const upH = this.floors * 3.1;
      this.box(14.2, upH, 14.2, facadeMat, 0, H + 0.3, -6, roof);
      for (let fl = 0; fl < this.floors; fl++) {
        for (let k = 0; k < 4; k++) {
          const x = -5.1 + k * 3.4;
          const lit = (k + fl) % 3 === 0;
          this.box(1.5, 1.7, 0.1, lit ? this.windowLit : this.windowDark, x, H + 0.95 + fl * 3.1, 1.06, roof, false);
          this.box(1.75, 0.12, 0.2, trim, x, H + 0.85 + fl * 3.1, 1.08, roof, false);
        }
      }
      this.box(14.6, 0.35, 14.6, trim, 0, H + 0.3 + upH, -6, roof);
    } else {
      this.box(14.4, 0.5, 0.25, facadeMat, 0, H + 0.3, 1.08, roof);
      this.box(2.2, 1.0, 1.6, mat('#a4a8ab', 0.5, 0.4), 3.5, H + 0.3, -9, roof);
    }
    this.roofParts.push(roof);

    // ---- the floor: counter, register, menu board, business-specific room ----
    this.buildFrontOfHouse(trim);
    this.buildBackOfHouse();
    this.buildOffice();

    // warm interior lights
    for (const [x, z, on] of [[-1, -2.8, 1], [3.5, -3, 0], [-3, -9.5, 0], [4.2, -9.5, 1]]) {
      const l = new THREE.PointLight('#ffd8a8', 0, on ? 11 : 0.01, 1.6);
      l.visible = !!on;
      l.position.set(x, 3.0, z);
      this.scene.add(l);
      this.interiorLights.push(l);
      const lamp = this.cyl(0.25, 0.32, 0.18, this.bulbMat, x, 3.0, z, this.scene, 12);
      lamp.castShadow = false;
      this.roofParts.push(lamp);
    }

    this.anchors.door = { x: 0, z: 1.4, r: 1.2 };
    // card spots
    this.spots.street.push({ x: -4.2, z: 3.25, h: 0 }, { x: 4.2, z: 3.25, h: 0 }, { x: -2.4, z: 3.35, h: 0 }, { x: 2.4, z: 3.35, h: 0 });
    this.spots.inside.push({ x: 0.3, z: -1.6, h: Math.PI }, { x: -0.8, z: -4.8, h: 0.4 }, { x: 0.6, z: -3.4, h: -0.6 }, { x: -1.3, z: -0.5, h: 2.6 });
    this.spots.back.push({ x: -0.8, z: -8.0, h: 2.4 }, { x: -5.3, z: -8.1, h: Math.PI }, { x: -0.7, z: -10.9, h: -2.2 }, { x: -5.2, z: -10.9, h: 2.8 });
    this.spots.office.push({ x: 2.5, z: -8.0, h: 2.6 }, { x: 6.1, z: -7.5, h: -2.6 }, { x: 2.4, z: -11.2, h: 1.6 }, { x: 6.2, z: -12.0, h: -1.2 });
  }

  userSign: THREE.MeshStandardMaterial | null = null;

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
    this.foliage.push(leaf);
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
    this.foliage.push(leaf);
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

  // ---------- neighbours on the north side ----------
  private building(x0: number, x1: number, zFront: number, depth: number, height: number, facing: 1 | -1, wall: THREE.Material, opts: { storefront?: boolean; sign?: THREE.Texture; trim?: string; door?: number } = {}) {
    const cx = (x0 + x1) / 2, w = x1 - x0;
    const zc = zFront - facing * depth / 2;
    this.box(w, height, depth, wall, cx, 0, zc);
    this.collider(x0, Math.min(zFront, zFront - facing * depth), x1, Math.max(zFront, zFront - facing * depth));
    const trim = mat(opts.trim ?? '#3a3734', 0.6);
    const fz = zFront + facing * 0.06;
    // upper windows
    for (let y = 4.4; y < height - 1.2; y += 3.1) {
      for (let x = x0 + 1.4; x < x1 - 0.8; x += 2.6) {
        const lit = ((x * 7 + y * 3) | 0) % 3 === 0;
        const win = this.box(1.3, 1.6, 0.08, lit ? this.windowLit : this.windowDark, x + 0.3, y, fz, this.scene, false);
        win.rotation.y = facing === 1 ? 0 : Math.PI;
        this.box(1.5, 0.1, 0.18, trim, x + 0.3, y - 0.1, fz, this.scene, false);
      }
    }
    // cornice
    this.box(w + 0.3, 0.35, 0.4, trim, cx, height - 0.35, zFront);
    if (opts.storefront !== false) {
      this.box(w - 1.2, 2.2, 0.06, this.windowDark, cx, 0.5, fz, this.scene, false);
      this.box(w - 1.0, 0.5, 0.14, trim, cx, 0, fz);
      if (opts.door !== undefined) this.box(1.5, 2.5, 0.1, mat('#2b2420', 0.6), opts.door, 0, fz + facing * 0.02, this.scene, false);
      if (opts.sign) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 2, 9), 0.7), new THREE.MeshStandardMaterial({ map: opts.sign, roughness: 0.6 }));
        s.position.set(cx, 3.1, zFront + facing * 0.12);
        if (facing === -1) s.rotation.y = Math.PI;
        this.scene.add(s);
      }
    }
  }

  private heightFor(base: number) {
    const loc = this.opts.location;
    return loc === 'low' ? base : loc === 'average' ? base + 3.1 : base + 9.3 + base * 0.8;
  }

  private buildNeighbours() {
    // the bank
    const stone = mat('#d3cab8', 0.85);
    this.building(-21, -9, 1, 15, this.heightFor(6.5), 1, stone, { door: -15, trim: '#8b8172', sign: signTexture('CIVIC SAVINGS', '#22324a', '#e9dcb8', { sub: 'Loans · Deposits' }) });
    for (const x of [-19.5, -17.2, -12.8, -10.5]) this.cyl(0.28, 0.32, 3.4, stone, x, 0, 1.4);
    this.collider(-20, 1.0, -10, 1.75);
    this.box(11.6, 0.3, 1.4, mat('#bdb3a2', 0.8), -15, 3.4, 1.4);
    this.anchors.bank = { x: -15, z: 2.2, r: 1.5 };
    // Marcus's gym
    const steel = mat('#59636c', 0.7, 0.2);
    this.building(9, 21, 1, 15, this.heightFor(5.5), 1, steel, { door: 15, trim: '#1f2428', sign: signTexture('IRON & OAK GYM', '#1f2428', '#f2b632', { sub: 'Open 5am – 11pm' }) });
    this.anchors.gym = { x: 14.2, z: 2.2, r: 1.5 };
    // alleys: walls + dumpsters
    for (const ax of [-8, 8]) {
      this.box(2, 2.4, 0.3, brickMat('#7a4c3c', [1, 1]), ax, 0, -1.5);
      this.collider(ax - 1, -14, ax + 1, 1);
      this.box(1.6, 1.1, 0.9, mat('#3f6b4f', 0.6, 0.3), ax, 0, 0.2);
    }
    // far buildings
    const palette = ['#9a5b4a', '#c9b79c', '#6d7a86', '#b07a52', '#8a8f78', '#a8a29a'];
    let k = 0;
    for (const [x0, x1] of [[-60, -48], [-47, -35], [-34, -23], [23, 34], [35, 47], [48, 60]]) {
      const h = this.heightFor(4.5 + ((k * 5) % 7));
      this.building(x0, x1, 1, 15, h, 1, brickMat(palette[k % palette.length], [3, Math.max(1, h / 4)]), { door: (x0 + x1) / 2 });
      k++;
    }
    // backdrop towers downtown
    if (this.opts.location === 'high') {
      for (let i = 0; i < 9; i++) {
        const x = -70 + i * 17;
        this.building(x, x + 12, -22, 14, 30 + ((i * 13) % 25), 1, mat(['#7c8794', '#9aa3ab', '#5f6b78'][i % 3], 0.6, 0.2), { storefront: false });
      }
    }
  }

  // ---------- south side: the rival storefront, a laundromat, more blocks ----------
  private buildSouthSide() {
    const o = this.opts;
    // rival / for lease storefront at x -7..7 facing north
    const wall = brickMat('#a35d48', [3, 1.5]);
    this.building(-7, 7, 15, 13, this.heightFor(5), -1, wall, { storefront: false });
    const trim = mat('#2c2a28', 0.6);
    this.box(13, 0.5, 0.2, trim, 0, 0, 14.9);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(12.6, 2.2, 0.05), this.glass);
    glass.position.set(0, 1.6, 14.92);
    this.scene.add(glass);
    this.rivalInterior = new THREE.Group();
    this.scene.add(this.rivalInterior);
    this.box(13.4, 0.02, 3, mat('#d9cfbf', 0.8), 0, 0.01, 16.6, this.rivalInterior, false);
    const rivalTable = mat('#3a3a3a', 0.5);
    for (const x of [-4, 0, 4]) this.box(1.2, 0.9, 0.7, rivalTable, x, 0, 16.5, this.rivalInterior);
    this.rivalSign = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.7), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
    this.rivalSign.position.set(0, 3.1, 14.86);
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
    void o;

    // laundromat west of it
    this.building(-21, -9, 15, 13, this.heightFor(4.5), -1, mat('#5f8fa0', 0.8), { sign: signTexture('SUDS LAUNDRY', '#f2efe8', '#2f6f7a', { sub: 'Wash · Dry · Fold' }), door: -15, trim: '#2f6f7a' });
    for (const [x0, x1] of [[-60, -48], [-47, -35], [-34, -22], [27, 38], [39, 50]]) {
      const h = this.heightFor(4 + ((x0 * 3) % 5 + 5) % 5);
      this.building(x0, x1, 15, 13, h, -1, brickMat(['#b07a52', '#8a8f78', '#9a5b4a', '#c9b79c'][Math.abs(x0) % 4], [3, Math.max(1, h / 4)]), { door: (x0 + x1) / 2 });
    }
    // the ad column on the south sidewalk
    const col = this.cyl(0.55, 0.55, 2.6, new THREE.MeshStandardMaterial({ map: signTexture('ADVERTISE HERE', '#efe6c8', '#b23a2e', { w: 512, h: 512, sub: 'Local · Citywide' }), roughness: 0.8 }), -11.5, 0, 14.4, this.scene, 20);
    this.cyl(0.62, 0.62, 0.25, mat('#2f4a3f', 0.6), -11.5, 2.6, 14.4);
    this.collider(-12.1, 13.8, -10.9, 15.0);
    this.anchors.ads = { x: -11.5, z: 13.2, r: 1.3, mesh: col };
    this.clickables.push(col);
  }

  // ---------- the market square / park ----------
  private buildPark() {
    const grass = new THREE.MeshStandardMaterial({ color: '#86a465', roughness: 1, map: noiseTexture('#ffffff', 40, [6, 6]) });
    this.grassMat = grass;
    this.box(17, 0.06, 12.5, grass, 17.5, -0.05, 21.4);
    const pathM = mat('#d8cdb5', 0.95);
    this.box(3, 0.07, 12.5, pathM, 17.5, -0.05, 21.4, this.scene, false);
    this.box(17, 0.07, 2.4, pathM, 17.5, -0.05, 22, this.scene, false);
    // fountain
    const stone = mat('#bdb5a6', 0.8);
    this.cyl(2.0, 2.1, 0.55, stone, 17.5, 0, 22);
    this.collider(15.6, 20.1, 19.4, 23.9);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.05, 32), new THREE.MeshStandardMaterial({ color: '#5aa0c8', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }));
    water.position.set(17.5, 0.5, 22);
    this.scene.add(water);
    this.fountainWater = water;
    water.userData.keep = true;
    this.cyl(0.25, 0.35, 1.3, stone, 17.5, 0.5, 22);
    this.cyl(0.7, 0.5, 0.15, stone, 17.5, 1.8, 22);
    // benches
    const bench = (x: number, z: number, h: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = h;
      this.scene.add(g);
      const wood = mat('#8a5a3a', 0.8);
      const iron = mat('#2b2e31', 0.5, 0.5);
      this.box(1.8, 0.07, 0.5, wood, 0, 0.44, 0, g);
      this.box(1.8, 0.4, 0.06, wood, 0, 0.55, -0.24, g);
      for (const lx of [-0.8, 0.8]) this.box(0.06, 0.44, 0.5, iron, lx, 0, 0, g);
      const c = Math.abs(Math.sin(h)) > 0.5;
      this.collider(x - (c ? 0.3 : 0.95), z - (c ? 0.95 : 0.3), x + (c ? 0.3 : 0.95), z + (c ? 0.95 : 0.3));
      return g;
    };
    bench(13.2, 19.0, Math.PI / 2);
    bench(13.2, 25.0, Math.PI / 2);
    const br = bench(21.8, 25.6, -Math.PI / 2);
    this.anchors.june = { x: 13.6 + 0.35, z: 19.0, r: 1.4 };
    this.anchors.bench = { x: 13.9, z: 25.0, r: 1.3, mesh: br };
    this.seats.push({ x: 13.45, z: 25.0, h: Math.PI / 2, y: 0.47, sit: true, taken: true, approach: { x: 14.2, z: 25.0 } });
    // market stalls
    const stall = (x: number, z: number, color: string, goods: string[]) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      this.scene.add(g);
      const wood = mat('#9a7448', 0.8);
      this.box(2.4, 0.9, 1.0, wood, 0, 0, 0, g);
      for (const [px, pz] of [[-1.15, -0.45], [1.15, -0.45], [-1.15, 0.45], [1.15, 0.45]]) this.box(0.08, 2.4, 0.08, wood, px, 0, pz, g, false);
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.5), new THREE.MeshStandardMaterial({ map: stripeTexture(color, '#f6f1e6', 8), side: THREE.DoubleSide, roughness: 0.9 }));
      roof.position.set(0, 2.45, 0);
      roof.rotation.x = -Math.PI / 2 + 0.25;
      roof.castShadow = true;
      g.add(roof);
      goods.forEach((c, i) => {
        const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat(c, 0.6));
        fruit.position.set(-0.9 + (i % 9) * 0.22, 0.98, -0.2 + Math.floor(i / 9) * 0.25);
        g.add(fruit);
      });
      this.collider(x - 1.25, z - 0.55, x + 1.25, z + 0.55);
      return g;
    };
    const s1 = stall(23.0, 18.0, '#3f7a5a', Array.from({ length: 18 }, (_, i) => ['#d94a3a', '#f0c23c', '#ff8a3d', '#6fae4a'][i % 4]));
    stall(23.0, 21.4, '#b23a2e', Array.from({ length: 18 }, (_, i) => ['#e8d9b0', '#c99a63', '#8a5a3a'][i % 3]));
    this.anchors.market = { x: 21.2, z: 19.7, r: 2.0, mesh: s1 };
    this.clickables.push(s1);
    // hedge at the back
    const hedge = new THREE.MeshStandardMaterial({ color: '#4d7a3f', roughness: 1, flatShading: true });
    this.foliage.push(hedge);
    this.box(17, 1.0, 0.8, hedge, 17.5, 0, 27.3);
  }

  private buildStreetFurniture() {
    // trees
    const trunk = mat('#6b4a33', 0.9);
    const leafA = new THREE.MeshStandardMaterial({ color: '#5f8f45', roughness: 0.9, flatShading: true });
    const leafB = new THREE.MeshStandardMaterial({ color: '#6f9c4c', roughness: 0.9, flatShading: true });
    this.foliage.push(leafA, leafB);
    const tree = (x: number, z: number, s = 1) => {
      this.cyl(0.13 * s, 0.18 * s, 2.0 * s, trunk, x, 0, z, this.scene, 8);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25 * s, 1), (x + z) % 2 ? leafA : leafB);
      crown.position.set(x, 2.6 * s, z);
      crown.castShadow = true;
      this.scene.add(crown);
      const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 * s, 1), leafB);
      c2.position.set(x + 0.5 * s, 3.2 * s, z - 0.3 * s);
      c2.castShadow = true;
      this.scene.add(c2);
      this.collider(x - 0.25, z - 0.25, x + 0.25, z + 0.25);
    };
    for (const x of [-20, -11.5, 11.5, 22]) tree(x, 3.55, 0.9);
    for (const x of [-18, -4.5, 4.5]) tree(x, 12.45, 0.9);
    for (const [x, z] of [[10.5, 16.5], [10.5, 26], [25, 16.2], [25, 26.5], [14.5, 16.2], [20.5, 26.5]]) tree(x, z, 1.15);
    // street lamps
    const iron = mat('#2a2d30', 0.5, 0.5);
    const lamp = (x: number, z: number, side: 1 | -1, light: boolean) => {
      this.cyl(0.07, 0.09, 4.2, iron, x, 0, z, this.scene, 8);
      this.box(0.08, 0.08, 1.0, iron, x, 4.15, z + side * 0.45, this.scene, false);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), this.bulbMat);
      bulb.position.set(x, 4.05, z + side * 0.9);
      this.scene.add(bulb);
      this.collider(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
      if (light) {
        const l = new THREE.PointLight('#ffcf8a', 0, 14, 1.5);
        l.position.set(x, 3.9, z + side * 0.9);
        this.scene.add(l);
        this.streetLights.push(l);
      }
    };
    lamp(-9, 3.7, 1, false);
    lamp(9, 3.7, 1, false);
    lamp(-16, 12.3, -1, false);
    lamp(1.5, 12.3, -1, true);
    lamp(16, 12.3, -1, false);
    // planters at the bounds
    const planter = mat('#8b8478', 0.9);
    for (const [x, z] of [[-23.5, 2.5], [-23.5, 13.5], [25.5, 2.5], [25.5, 13.5]]) {
      this.box(1.2, 0.6, 2.4, planter, x, 0, z);
      const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), leafA);
      shrub.position.set(x, 0.9, z);
      this.scene.add(shrub);
    }
    // bike rack + newspaper box near the shop
    this.box(0.5, 1.0, 0.45, mat('#2c5d9c', 0.5), -6.2, 0, 3.5);
    this.collider(-6.45, 3.27, -5.95, 3.73);
    // bus stop shelter on the south walk
    const shelter = mat('#2b2e31', 0.4, 0.5);
    this.box(3.0, 0.1, 1.2, shelter, -16, 2.5, 13.9);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 0.04), this.glass);
    back.position.set(-16, 1.4, 14.45);
    this.scene.add(back);
    this.box(2.4, 0.08, 0.4, mat('#8a5a3a', 0.8), -16, 0.45, 14.2);
    this.collider(-17.5, 14.0, -14.5, 14.5);
  }

  // ---------- dynamic look ----------
  setRival(name: string | null) {
    const m = this.rivalSign.material as THREE.MeshStandardMaterial;
    m.map?.dispose();
    m.map = name ? signTexture(name, '#3a1f22', '#f2d7a0', { sub: 'Now open' }) : signTexture('', '#4a4642', '#4a4642');
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
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 12), cone);
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
    const cols: Record<string, [string, string]> = {
      spring: ['#6aa04e', '#e8a5b8'],
      summer: ['#4f8a3c', '#5f9a45'],
      autumn: ['#c9772f', '#b8452c'],
      winter: ['#9aa79a', '#c9d2cf'],
    };
    const [a, b] = cols[season];
    this.foliage.forEach((m, i) => m.color.set(i % 3 === 2 ? b : a));
    this.grassMat.color.set(season === 'winter' ? '#d7dfe0' : season === 'autumn' ? '#9a9a5c' : '#86a465');
    if (this.snow) { this.snow.removeFromParent(); this.snow = null; }
    if (season === 'winter') {
      const n = 1400;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 60;
        pos[i * 3 + 1] = Math.random() * 18;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 50 + 6;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }));
      this.scene.add(this.snow);
    }
  }

  /** 0 = 8am, 1 = dusk */
  setTime(t: number) {
    this.t = t;
    const keys = [
      { t: 0, top: '#86b5e3', bottom: '#f4e3cf', sun: '#ffd9ae', si: 2.2, hemi: 1.0, el: 0.42, az: 1.05 },
      { t: 0.45, top: '#5e9ce0', bottom: '#dfeaf2', sun: '#fff4e4', si: 3.0, hemi: 1.15, el: 1.0, az: 0.15 },
      { t: 0.8, top: '#6c8fc4', bottom: '#f1c9a0', sun: '#ffc48a', si: 2.3, hemi: 0.95, el: 0.45, az: -0.75 },
      { t: 1, top: '#26355f', bottom: '#e99a6e', sun: '#ff9358', si: 1.1, hemi: 0.55, el: 0.14, az: -1.1 },
    ];
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const a = keys[i], b = keys[i + 1];
    const k = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
    const lerp = (x: number, y: number) => x + (y - x) * k;
    const col = (x: string, y: string) => new THREE.Color(x).lerp(new THREE.Color(y), k);
    this.skyMat.uniforms.top.value.copy(col(a.top, b.top));
    this.skyMat.uniforms.bottom.value.copy(col(a.bottom, b.bottom));
    (this.scene.fog as THREE.Fog).color.copy(col(a.bottom, b.bottom));
    this.sun.color.copy(col(a.sun, b.sun));
    this.sun.intensity = lerp(a.si, b.si);
    this.hemi.intensity = lerp(a.hemi, b.hemi);
    this.sunEl = lerp(a.el, b.el);
    this.sunAz = lerp(a.az, b.az);
    const night = Math.max(0, (t - 0.72) / 0.28);
    this.bulbMat.emissiveIntensity = night * 2.5;
    this.windowLit.emissiveIntensity = night * 1.4;
    for (const l of this.streetLights) l.intensity = night * 18;
    for (const l of this.interiorLights) l.intensity = 2 + night * 10;
    if (this.userSign) this.userSign.emissiveIntensity = night * 0.55;
  }
  private sunEl = 1;
  private sunAz = 0;

  /** Per-frame: sun follows the focus, walls cut away when you're inside. */
  update(dt: number, focus: THREE.Vector3, camPos: THREE.Vector3, playerInside: boolean, playerPos: THREE.Vector3) {
    const d = 45;
    this.sun.position.set(
      focus.x + Math.sin(this.sunAz) * Math.cos(this.sunEl) * d,
      Math.sin(this.sunEl) * d,
      focus.z + Math.cos(this.sunAz) * Math.cos(this.sunEl) * d,
    );
    this.sun.target.position.copy(focus);
    this.sky.position.copy(camPos);

    if (playerInside !== this.cutaway) {
      this.cutaway = playerInside;
      for (const r of this.roofParts) r.visible = !playerInside;
    }
    for (const w of this.walls) {
      let cut = false;
      if (playerInside) {
        const sc = (camPos.x - w.px) * w.nx + (camPos.z - w.pz) * w.nz;
        const sp = (playerPos.x - w.px) * w.nx + (playerPos.z - w.pz) * w.nz;
        cut = Math.sign(sc) !== Math.sign(sp);
      }
      w.full.visible = !cut;
      if (w.short) w.short.visible = cut;
    }
    if (this.snow) {
      const p = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - dt * 1.4;
        if (y < 0) y += 18;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(y + i) * dt * 0.2);
      }
      p.needsUpdate = true;
      this.snow.position.set(focus.x, 0, focus.z - 6);
    }
    if (this.fountainWater) this.fountainWater.rotation.y += dt * 0.2;
  }
}

function groupOf(a: THREE.Object3D, b: THREE.Object3D) {
  const g = new THREE.Group();
  a.parent?.add(g);
  g.add(a, b);
  return g;
}

const brickCache = new Map<string, THREE.MeshStandardMaterial>();
function brickMat(color: string, repeat: [number, number]) {
  const key = color + repeat.join(',');
  let m = brickCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, map: brickTexture(color, repeat) });
    brickCache.set(key, m);
  }
  return m;
}
