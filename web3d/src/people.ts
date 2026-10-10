// People: a jointed human rig (hips, knees, shoulders, elbows) with realistic
// proportions, a procedural walk/run cycle, proper sitting, and path following.
import * as THREE from 'three';
import type { CharacterLook } from '../../src/game/cast';
import { Box, P2, collide } from './nav';
import { batch } from './batch';

export type Look = CharacterLook & {
  pants?: string;
  shoes?: string;
  capColor?: string;
  sleeves?: 'short' | 'long';
  bottom?: 'pants' | 'skirt';
  build?: number; // 0.9 slim … 1.15 broad
  height?: number; // scale, ~0.92 … 1.08
};

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: string, rough = 0.85, metal = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}|${metal}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    matCache.set(key, m);
  }
  return m;
}

// torso as a lathe: hips → waist → chest → shoulders
const torsoProfile = [
  [0.0, 0.0], [0.155, 0.0], [0.15, 0.06], [0.135, 0.17], [0.15, 0.27], [0.172, 0.36], [0.182, 0.42], [0.165, 0.47], [0.1, 0.505], [0.0, 0.515],
].map(([r, y]) => new THREE.Vector2(r, y));
const skirtProfile = [[0.16, 0.0], [0.2, -0.2], [0.25, -0.42], [0.0, -0.42]].map(([r, y]) => new THREE.Vector2(r, y));

const G = {
  torso: new THREE.LatheGeometry(torsoProfile, 20).scale(1, 1, 0.66),
  pelvis: new THREE.SphereGeometry(0.155, 18, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65).scale(1, 0.9, 0.7),
  skirt: new THREE.LatheGeometry(skirtProfile, 20).scale(1, 1, 0.75),
  thigh: new THREE.CapsuleGeometry(0.068, 0.34, 4, 12).translate(0, -0.21, 0),
  shin: new THREE.CapsuleGeometry(0.052, 0.36, 4, 12).translate(0, -0.215, 0),
  shoe: new THREE.BoxGeometry(0.095, 0.075, 0.25).translate(0, -0.468, 0.045),
  upperArm: new THREE.CapsuleGeometry(0.047, 0.22, 4, 10).translate(0, -0.15, 0),
  forearm: new THREE.CapsuleGeometry(0.04, 0.2, 4, 10).translate(0, -0.135, 0),
  hand: new THREE.SphereGeometry(0.044, 10, 8).scale(0.8, 1.15, 0.55).translate(0, -0.3, 0),
  neck: new THREE.CylinderGeometry(0.048, 0.055, 0.12, 12),
  head: new THREE.SphereGeometry(0.11, 28, 22).scale(0.9, 1.12, 1.0),
  jaw: new THREE.SphereGeometry(0.085, 18, 12).scale(0.95, 0.75, 1.0),
  sclera: new THREE.SphereGeometry(0.0155, 12, 8).scale(1.25, 0.9, 0.6),
  iris: new THREE.SphereGeometry(0.0085, 10, 8),
  brow: new THREE.BoxGeometry(0.036, 0.008, 0.01),
  nose: new THREE.ConeGeometry(0.014, 0.036, 8).rotateX(-0.25),
  lip: new THREE.CapsuleGeometry(0.0055, 0.03, 3, 6).rotateZ(Math.PI / 2),
  ear: new THREE.SphereGeometry(0.02, 8, 6).scale(0.5, 1.2, 0.85),
  hairCap: new THREE.SphereGeometry(0.118, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(0.93, 1.12, 1.04),
  hairBack: new THREE.SphereGeometry(0.117, 22, 12, Math.PI * 1.05, Math.PI * 0.9, Math.PI * 0.3, Math.PI * 0.4).scale(0.93, 1.12, 1.04),
  afro: new THREE.IcosahedronGeometry(0.14, 3),
  bun: new THREE.SphereGeometry(0.048, 14, 10),
  longBack: new THREE.CylinderGeometry(0.112, 0.125, 0.3, 20, 1, true, Math.PI * 0.6, Math.PI * 0.8),
  pony: new THREE.CapsuleGeometry(0.03, 0.18, 4, 8),
  capTop: new THREE.SphereGeometry(0.122, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.42).scale(0.95, 1.05, 1.05),
  capBrim: new THREE.CylinderGeometry(0.095, 0.095, 0.012, 18, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.15),
  hardhat: new THREE.SphereGeometry(0.135, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
  hatBrim: new THREE.CylinderGeometry(0.16, 0.16, 0.014, 22),
  lens: new THREE.TorusGeometry(0.021, 0.0035, 6, 18),
  bridge: new THREE.BoxGeometry(0.022, 0.004, 0.004),
  apron: new THREE.PlaneGeometry(0.3, 0.6),
  tie: new THREE.BoxGeometry(0.045, 0.3, 0.01),
  collar: new THREE.TorusGeometry(0.06, 0.016, 6, 16).rotateX(Math.PI / 2).scale(1, 1, 0.8),
  clip: new THREE.BoxGeometry(0.17, 0.23, 0.012),
  phone: new THREE.BoxGeometry(0.035, 0.07, 0.008),
  brooch: new THREE.SphereGeometry(0.014, 8, 6),
  belt: new THREE.TorusGeometry(0.15, 0.012, 4, 22).rotateX(Math.PI / 2).scale(1, 1, 0.68),
};

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

let idSeq = 0;

export class Person {
  readonly id = ++idSeq;
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private hip = new THREE.Group();
  private torso = new THREE.Group();
  private thighL: THREE.Group; private thighR: THREE.Group;
  private shinL: THREE.Group; private shinR: THREE.Group;
  private armL: THREE.Group; private armR: THREE.Group;
  private elbowL: THREE.Group; private elbowR: THREE.Group;
  private head = new THREE.Group();
  look: Look;
  speed = 1.35;
  heading = 0;
  private targetHeading = 0;
  path: P2[] = [];
  onArrive: (() => void) | null = null;
  private phase = Math.random() * 10;
  private t = Math.random() * 10;
  private gesture: 'none' | 'talk' | 'work' | 'wave' = 'none';
  sitting = false;
  sitHeight = 0.47;
  moving = false;
  radius = 0.28;
  lookTarget: THREE.Vector3 | null = null;
  userData: Record<string, unknown> = {};
  readonly hit: THREE.Mesh;
  readonly scale: number;
  static readonly HIP = 0.93;

  constructor(look: Look, opts: { scale?: number } = {}) {
    this.look = look;
    const top = mat(look.clothes, 0.88);
    const pants = mat(look.pants ?? shade(look.clothes, 0.42), 0.9);
    const skin = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.55 });
    const hair = mat(look.hairColor, 0.7);
    const shoe = mat(look.shoes ?? '#24201d', 0.55);
    const build = look.build ?? 1;
    const add = <T extends THREE.Object3D>(parent: THREE.Object3D, o: T) => { parent.add(o); return o; };
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => {
      const x = new THREE.Mesh(g, m);
      x.castShadow = shadow;
      return x;
    };

    this.root.add(this.body);
    this.hip.position.y = Person.HIP;
    this.body.add(this.hip);
    const pel = add(this.hip, mesh(G.pelvis, look.bottom === 'skirt' ? top : pants));
    pel.position.y = 0.02;
    pel.scale.x = build;
    if (look.bottom === 'skirt') add(this.hip, mesh(G.skirt, top)).position.y = 0.03;
    else add(this.hip, mesh(G.belt, mat('#2a2522', 0.5), false)).position.y = 0.06;

    // legs: hip → knee
    const leg = (x: number) => {
      const thigh = new THREE.Group();
      thigh.position.set(x * build, 0, 0);
      this.hip.add(thigh);
      thigh.add(mesh(G.thigh, look.bottom === 'skirt' ? skin : pants));
      const shin = new THREE.Group();
      shin.position.y = -0.42;
      thigh.add(shin);
      shin.add(mesh(G.shin, look.bottom === 'skirt' ? skin : pants));
      shin.add(mesh(G.shoe, shoe));
      return [thigh, shin] as const;
    };
    [this.thighL, this.shinL] = leg(0.088);
    [this.thighR, this.shinR] = leg(-0.088);

    // torso
    this.torso.position.y = 0.04;
    this.hip.add(this.torso);
    const t = add(this.torso, mesh(G.torso, top));
    t.scale.x = build;
    const neck = add(this.torso, mesh(G.neck, skin));
    neck.position.y = 0.55;

    const arm = (x: number) => {
      const sh = new THREE.Group();
      sh.position.set(x * build, 0.45, 0);
      sh.rotation.z = x > 0 ? 0.08 : -0.08;
      this.torso.add(sh);
      sh.add(mesh(G.upperArm, top));
      const el = new THREE.Group();
      el.position.y = -0.3;
      sh.add(el);
      el.add(mesh(G.forearm, look.sleeves === 'short' ? skin : top));
      el.add(mesh(G.hand, skin));
      return [sh, el] as const;
    };
    [this.armL, this.elbowL] = arm(0.205);
    [this.armR, this.elbowR] = arm(-0.205);

    // head
    this.head.position.y = 0.66;
    this.torso.add(this.head);
    this.head.add(mesh(G.head, skin));
    add(this.head, mesh(G.jaw, skin)).position.set(0, -0.05, 0.012);
    const white = mat('#f4f1ea', 0.35);
    const iris = mat('#2a1d16', 0.3);
    for (const sx of [-1, 1]) {
      const s = add(this.head, mesh(G.sclera, white, false));
      s.position.set(sx * 0.037, 0.012, 0.093);
      const i = add(this.head, mesh(G.iris, iris, false));
      i.position.set(sx * 0.037, 0.012, 0.102);
      const b = add(this.head, mesh(G.brow, hair, false));
      b.position.set(sx * 0.038, 0.04, 0.1);
      b.rotation.z = sx * -0.12;
      const e = add(this.head, mesh(G.ear, skin, false));
      e.position.set(sx * 0.1, 0.0, 0.0);
    }
    const nose = add(this.head, mesh(G.nose, mat(shade(look.skin, 0.93), 0.55), false));
    nose.position.set(0, -0.012, 0.112);
    const lip = add(this.head, mesh(G.lip, mat(shade(look.skin, 0.68), 0.5), false));
    lip.position.set(0, -0.056, 0.093);
    this.buildHair(hair);
    this.buildAccessory();
    batch(this.head);

    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.85, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = 0.92;
    this.hit.userData.person = this;
    this.root.userData.person = this;
    this.root.add(this.hit);

    this.scale = opts.scale ?? look.height ?? 1;
    this.root.scale.setScalar(this.scale);
  }

  private buildHair(hair: THREE.Material) {
    const style = this.look.hair;
    const h = this.head;
    const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      h.add(mesh);
      return mesh;
    };
    if (style === 'bald') return;
    if (style === 'cap') {
      const capM = mat(this.look.capColor ?? shade(this.look.clothes, 0.75), 0.75);
      add(G.hairBack, hair, 0, -0.005, -0.004);
      const top = add(G.capTop, capM, 0, 0.012, -0.004);
      top.rotation.x = -0.1;
      const brim = add(G.capBrim, capM, 0, 0.045, 0.1);
      brim.rotation.x = 0.1;
      return;
    }
    if (style === 'curly') {
      const a = add(G.afro, hair, 0, 0.04, -0.018);
      a.scale.set(0.93, 0.86, 0.9);
      return;
    }
    const cap = add(G.hairCap, hair, 0, 0.004, -0.006);
    cap.rotation.x = -0.32;
    add(G.hairBack, hair);
    if (style === 'bun') add(G.bun, hair, 0, 0.1, -0.09);
    else if (style === 'long') {
      const l = add(G.longBack, hair, 0, -0.1, -0.004);
      l.scale.set(0.95, 1, 0.95);
    } else if (style === 'ponytail') {
      const p = add(G.pony, hair, 0, -0.04, -0.13);
      p.rotation.x = 0.3;
      add(G.bun, hair, 0, 0.02, -0.112).scale.setScalar(0.6);
    }
  }

  private buildAccessory() {
    const acc = this.look.accessory;
    if (!acc) return;
    if (acc === 'glasses') {
      const m = mat('#26262b', 0.35, 0.4);
      for (const sx of [-1, 1]) {
        const l = new THREE.Mesh(G.lens, m);
        l.position.set(sx * 0.037, 0.013, 0.108);
        this.head.add(l);
      }
      const b = new THREE.Mesh(G.bridge, m);
      b.position.set(0, 0.015, 0.112);
      this.head.add(b);
    } else if (acc === 'hardhat') {
      const m = mat('#f2b632', 0.45);
      const hh = new THREE.Mesh(G.hardhat, m);
      hh.position.y = 0.025;
      hh.castShadow = true;
      this.head.add(hh);
      const br = new THREE.Mesh(G.hatBrim, m);
      br.position.set(0, 0.03, 0.01);
      this.head.add(br);
    } else if (acc === 'apron') {
      const ap = new THREE.Mesh(G.apron, new THREE.MeshStandardMaterial({ color: '#f1ede4', roughness: 0.95, side: THREE.DoubleSide }));
      ap.position.set(0, 0.2, 0.118);
      ap.rotation.x = -0.08;
      this.torso.add(ap);
    } else if (acc === 'tie') {
      const tie = new THREE.Mesh(G.tie, mat('#8f2732', 0.55));
      tie.position.set(0, 0.36, 0.123);
      tie.rotation.x = -0.12;
      this.torso.add(tie);
      const col = new THREE.Mesh(G.collar, mat('#f2f0ea', 0.7));
      col.position.set(0, 0.5, 0.005);
      this.torso.add(col);
    } else if (acc === 'clipboard') {
      const c = new THREE.Mesh(G.clip, mat('#9a7448', 0.65));
      c.position.set(0, -0.3, 0.06);
      c.rotation.x = -0.4;
      this.elbowR.add(c);
      this.armR.userData.hold = -0.4;
      this.elbowR.userData.hold = -1.1;
    } else if (acc === 'phone') {
      const p = new THREE.Mesh(G.phone, mat('#18181c', 0.25, 0.3));
      p.position.set(0, -0.31, 0.03);
      p.rotation.x = -0.4;
      this.elbowR.add(p);
      this.armR.userData.hold = -0.25;
      this.elbowR.userData.hold = -1.5;
    } else if (acc === 'brooch' || acc === 'scissorsPin') {
      const b = new THREE.Mesh(G.brooch, mat(acc === 'brooch' ? '#d9b44a' : '#c9cdd2', 0.3, 0.8));
      b.position.set(0.075, 0.4, 0.105);
      this.torso.add(b);
    }
  }

  get x() { return this.root.position.x; }
  get z() { return this.root.position.z; }
  /** eye height above the ground, in world units */
  get eyeHeight() { return (Person.HIP + 0.04 + 0.66 + 0.012) * this.scale + this.root.position.y + this.body.position.y * this.scale; }

  setVisible(v: boolean) { this.body.visible = v; }

  place(x: number, z: number, heading = this.heading) {
    this.root.position.set(x, this.root.position.y, z);
    this.heading = this.targetHeading = heading;
    this.root.rotation.y = heading;
  }

  face(x: number, z: number) {
    const dx = x - this.x, dz = z - this.z;
    if (dx * dx + dz * dz > 1e-4) this.targetHeading = Math.atan2(dx, dz);
  }
  faceHeading(h: number) { this.targetHeading = h; }
  /** snap the body to a heading (first-person turns) */
  setHeading(h: number) { this.heading = this.targetHeading = h; this.root.rotation.y = h; }

  walkTo(path: P2[] | null, onArrive: (() => void) | null = null) {
    this.sitting = false;
    this.path = path ? [...path] : [];
    this.onArrive = onArrive;
    if (!this.path.length && onArrive) { this.onArrive = null; onArrive(); }
  }

  stop() { this.path = []; this.onArrive = null; }

  sit(heading: number) {
    this.stop();
    this.sitting = true;
    this.faceHeading(heading);
    this.heading = heading;
  }

  update(dt: number, groundY: (x: number, z: number) => number, boxes?: Box[]) {
    let moved = 0;
    if (this.path.length && !this.sitting) {
      const wp = this.path[0];
      const dx = wp.x - this.x, dz = wp.z - this.z;
      const d = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (d <= Math.max(step, 0.06)) {
        this.root.position.x = wp.x;
        this.root.position.z = wp.z;
        this.path.shift();
        moved = d;
        if (!this.path.length) {
          const cb = this.onArrive;
          this.onArrive = null;
          cb?.();
        }
      } else {
        this.root.position.x += (dx / d) * step;
        this.root.position.z += (dz / d) * step;
        this.targetHeading = Math.atan2(dx, dz);
        moved = step;
      }
      if (boxes) {
        const p = { x: this.root.position.x, z: this.root.position.z };
        collide(p, this.radius, boxes);
        this.root.position.x = p.x;
        this.root.position.z = p.z;
      }
    }
    this.animate(dt, moved / Math.max(dt, 1e-4), groundY);
  }

  /** Drive the rig from ground speed (m/s). */
  animate(dt: number, speed: number, groundY: (x: number, z: number) => number) {
    this.t += dt;
    this.moving = speed > 0.15;
    let dh = this.targetHeading - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * Math.min(1, dt * 9);
    this.root.rotation.y = this.heading;
    const gy = groundY(this.x, this.z);
    this.root.position.y += (gy - this.root.position.y) * Math.min(1, dt * 12);

    const k = Math.min(1, dt * 10);
    const ease = (o: THREE.Object3D, v: number, axis: 'x' | 'y' | 'z' = 'x') => { o.rotation[axis] += (v - o.rotation[axis]) * k; };
    const holdA = (this.armR.userData.hold as number | undefined) ?? 0;
    const holdE = (this.elbowR.userData.hold as number | undefined) ?? 0;

    if (this.sitting) {
      this.body.position.y += (this.sitHeight + 0.07 - Person.HIP - this.body.position.y) * k;
      ease(this.thighL, -1.5); ease(this.thighR, -1.5);
      ease(this.shinL, 1.45); ease(this.shinR, 1.45);
      ease(this.armL, -0.35); ease(this.elbowL, -0.9);
      ease(this.armR, holdA || -0.35); ease(this.elbowR, holdE || -0.9);
      ease(this.torso, 0.04); ease(this.torso, 0, 'y');
      this.torso.position.y = 0.04 + Math.sin(this.t * 1.8) * 0.003;
    } else if (this.moving) {
      const run = speed > 3;
      this.phase += dt * speed * (run ? 2.4 : 3.6);
      const p = this.phase;
      const A = run ? 0.75 : Math.min(0.5, 0.22 + speed * 0.18);
      const K = run ? 1.5 : 0.75;
      this.thighL.rotation.x = -A * Math.sin(p);
      this.thighR.rotation.x = A * Math.sin(p);
      this.shinL.rotation.x = 0.05 + K * Math.max(0, Math.cos(p)) * (run ? 1 : 0.9);
      this.shinR.rotation.x = 0.05 + K * Math.max(0, -Math.cos(p)) * (run ? 1 : 0.9);
      const armA = run ? 0.9 : A * 0.75;
      this.armL.rotation.x = armA * Math.sin(p);
      this.elbowL.rotation.x = run ? -1.4 : -0.25 - 0.25 * Math.max(0, -Math.sin(p));
      this.armR.rotation.x = holdA || -armA * Math.sin(p);
      this.elbowR.rotation.x = holdE || (run ? -1.4 : -0.25 - 0.25 * Math.max(0, Math.sin(p)));
      this.body.position.y = -0.025 + Math.abs(Math.cos(p)) * (run ? 0.06 : 0.03);
      this.torso.rotation.y = Math.sin(p) * (run ? 0.14 : 0.07);
      this.torso.rotation.x = run ? 0.18 : 0.03;
      this.hip.rotation.y = -Math.sin(p) * 0.06;
    } else {
      // standing: weight shift and breathing
      const sway = Math.sin(this.t * 0.9);
      ease(this.thighL, 0.02 + sway * 0.02); ease(this.thighR, -0.02 + sway * 0.02);
      ease(this.shinL, 0.04); ease(this.shinR, 0.06);
      ease(this.hip, 0, 'y');
      ease(this.torso, 0.0); ease(this.torso, 0, 'y');
      this.body.position.y += (0 - this.body.position.y) * k;
      this.torso.position.y = 0.04 + Math.sin(this.t * 1.8) * 0.004;
      if (this.gesture === 'none') {
        ease(this.armL, Math.sin(this.t * 1.1) * 0.03); ease(this.elbowL, -0.12);
        ease(this.armR, holdA || -Math.sin(this.t * 1.1) * 0.03); ease(this.elbowR, holdE || -0.12);
        this.armR.rotation.z += (-0.08 - this.armR.rotation.z) * k;
      }
    }

    // gestures layered on top
    if (this.gesture === 'talk' && !this.moving) {
      ease(this.elbowR, -0.9 + Math.sin(this.t * 4) * 0.25);
      ease(this.armR, -0.25 + Math.sin(this.t * 2.3) * 0.1);
      this.head.rotation.x = Math.sin(this.t * 7) * 0.04;
    } else if (this.gesture === 'work') {
      ease(this.armL, -0.7 + Math.sin(this.t * 10) * 0.15); ease(this.elbowL, -0.9);
      ease(this.armR, -0.7 - Math.sin(this.t * 10) * 0.15); ease(this.elbowR, -0.9);
      this.head.rotation.x = 0.3;
    } else if (this.gesture === 'wave') {
      ease(this.armR, -2.7);
      this.armR.rotation.z = -0.2 + Math.sin(this.t * 9) * 0.3;
      ease(this.elbowR, -0.4);
    } else {
      this.head.rotation.x += (0 - this.head.rotation.x) * k;
    }

    // head turns toward a point of interest
    let want = 0;
    if (this.lookTarget) {
      const dx = this.lookTarget.x - this.x, dz = this.lookTarget.z - this.z;
      let rel = Math.atan2(dx, dz) - this.heading;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      if (Math.abs(rel) < 1.6) want = Math.max(-0.9, Math.min(0.9, rel));
    }
    this.head.rotation.y += (want - this.head.rotation.y) * Math.min(1, dt * 6);
  }

  talk() { this.gesture = 'talk'; }
  quiet() { this.gesture = 'none'; }
  work() { this.gesture = 'work'; }
  wave() { this.gesture = 'wave'; }
  rest() { this.gesture = 'none'; this.armR.rotation.z = -0.08; }

  dispose() { this.root.removeFromParent(); }
}

export const SKINS = ['#f6d5b8', '#ecc19c', '#dca37a', '#c68863', '#a86a45', '#8d5a3b', '#6e4632', '#4f3122'];
export const HAIRS = ['#14100e', '#2b2320', '#4a3122', '#6d4a2b', '#a9713d', '#d1a866', '#8a8a8a', '#dedad2', '#7a2f22'];
export const OUTFITS = ['#3b5f8c', '#9b3d3d', '#3f7a5a', '#c48a2f', '#6b4f8f', '#2f6f7a', '#c25f7a', '#5c6670', '#d1c4a8', '#36404d', '#b9572f', '#7d8f45', '#f1efe8', '#1f2328'];
export const PANTS = ['#2d3440', '#3a3a3e', '#4b3d31', '#2c3e5c', '#5a5550', '#1f2328', '#6b6458', '#8a7b62'];
export const STYLES: Look['hair'][] = ['short', 'curly', 'bun', 'long', 'cap', 'bald', 'ponytail'];

export function randomLook(rand = Math.random): Look {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const hair = pick([...STYLES, 'short', 'long']);
  const acc = rand() < 0.14 ? 'glasses' : rand() < 0.07 ? 'phone' : undefined;
  return {
    skin: pick(SKINS), hair, hairColor: pick(HAIRS), clothes: pick(OUTFITS),
    pants: pick(PANTS), accessory: acc as Look['accessory'],
    sleeves: rand() < 0.4 ? 'short' : 'long',
    bottom: (hair === 'long' || hair === 'bun' || hair === 'ponytail') && rand() < 0.35 ? 'skirt' : 'pants',
    build: 0.92 + rand() * 0.2,
    height: 0.93 + rand() * 0.13,
  };
}
