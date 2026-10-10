// Low-poly people: a simple rig built from primitives, a procedural walk
// cycle, sitting, and path following. Everyone in the world is one of these.
import * as THREE from 'three';
import type { CharacterLook } from '../../src/game/cast';
import { Box, P2, collide } from './nav';
import { batch } from './batch';

export type Look = CharacterLook & { pants?: string; shoes?: string; capColor?: string };

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

const G = {
  leg: new THREE.CapsuleGeometry(0.078, 0.56, 4, 10).translate(0, -0.36, 0),
  shoe: new THREE.BoxGeometry(0.13, 0.08, 0.22).translate(0, -0.72, 0.035),
  pelvis: new THREE.CapsuleGeometry(0.16, 0.12, 4, 12).rotateZ(Math.PI / 2),
  torso: new THREE.CapsuleGeometry(0.175, 0.3, 4, 14),
  neck: new THREE.CylinderGeometry(0.055, 0.06, 0.1, 10),
  head: new THREE.SphereGeometry(0.185, 22, 16),
  arm: new THREE.CapsuleGeometry(0.058, 0.4, 4, 8).translate(0, -0.24, 0),
  hand: new THREE.SphereGeometry(0.062, 10, 8).translate(0, -0.5, 0),
  eye: new THREE.SphereGeometry(0.026, 8, 6),
  brow: new THREE.BoxGeometry(0.075, 0.016, 0.02),
  nose: new THREE.SphereGeometry(0.03, 8, 6),
  mouth: new THREE.BoxGeometry(0.07, 0.014, 0.02),
  hairCap: new THREE.SphereGeometry(0.198, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.48),
  hairBack: new THREE.SphereGeometry(0.196, 18, 12, Math.PI * 1.1, Math.PI * 0.8, Math.PI * 0.3, Math.PI * 0.42),
  curl: new THREE.SphereGeometry(0.075, 8, 6),
  bun: new THREE.SphereGeometry(0.095, 12, 10),
  longHair: new THREE.BoxGeometry(0.34, 0.4, 0.1),
  pony: new THREE.CapsuleGeometry(0.05, 0.22, 4, 8),
  capTop: new THREE.SphereGeometry(0.205, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
  capBrim: new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16, 1, false, -Math.PI / 2, Math.PI),
  hardhat: new THREE.SphereGeometry(0.215, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
  hatBrim: new THREE.CylinderGeometry(0.27, 0.27, 0.025, 20),
  lens: new THREE.TorusGeometry(0.045, 0.009, 6, 16),
  bridge: new THREE.BoxGeometry(0.05, 0.01, 0.01),
  apron: new THREE.BoxGeometry(0.34, 0.56, 0.03),
  tie: new THREE.BoxGeometry(0.06, 0.32, 0.025),
  clip: new THREE.BoxGeometry(0.2, 0.27, 0.02),
  phone: new THREE.BoxGeometry(0.07, 0.13, 0.015),
  brooch: new THREE.SphereGeometry(0.03, 8, 6),
};

const DARK = '#1c1a19';

function darken(hex: string, k: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

let idSeq = 0;

export class Person {
  readonly id = ++idSeq;
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private legL: THREE.Object3D;
  private legR: THREE.Object3D;
  private armL: THREE.Object3D;
  private armR: THREE.Object3D;
  private head: THREE.Object3D;
  private torso: THREE.Object3D;
  look: Look;
  speed = 1.35;
  heading = 0;
  private targetHeading = 0;
  path: P2[] = [];
  onArrive: (() => void) | null = null;
  private phase = Math.random() * 10;
  private t = Math.random() * 10;
  sitting = false;
  sitHeight = 0.47;
  moving = false;
  radius = 0.3;
  /** world point the head turns toward, if any */
  lookTarget: THREE.Vector3 | null = null;
  userData: Record<string, unknown> = {};
  /** extra hit-test mesh for clicks */
  readonly hit: THREE.Mesh;

  constructor(look: Look, opts: { scale?: number } = {}) {
    this.look = look;
    const clothes = mat(look.clothes, 0.9);
    const pants = mat(look.pants ?? darken(look.clothes, 0.45), 0.9);
    const skin = mat(look.skin, 0.65);
    const hair = mat(look.hairColor, 0.8);
    const shoe = mat(look.shoes ?? '#2a2522', 0.7);
    const shadowy = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = false; return m; };

    this.root.add(this.body);
    const hipY = 0.86;
    const mk = (g: THREE.BufferGeometry, m: THREE.Material) => shadowy(new THREE.Mesh(g, m));

    // legs (pivot at the hip)
    const leg = (x: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, hipY, 0);
      pivot.add(mk(G.leg, pants));
      pivot.add(mk(G.shoe, shoe));
      this.body.add(pivot);
      return pivot;
    };
    this.legL = leg(0.095);
    this.legR = leg(-0.095);

    const pelvis = mk(G.pelvis, pants);
    pelvis.position.set(0, hipY + 0.02, 0);
    pelvis.scale.set(1, 1, 0.8);
    this.body.add(pelvis);

    this.torso = mk(G.torso, clothes);
    this.torso.position.set(0, 1.2, 0);
    this.torso.scale.set(1.12, 1, 0.78);
    this.body.add(this.torso);

    const neck = mk(G.neck, skin);
    neck.position.set(0, 1.5, 0);
    this.body.add(neck);

    // arms (pivot at the shoulder)
    const arm = (x: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.43, 0);
      pivot.add(mk(G.arm, clothes));
      pivot.add(mk(G.hand, skin));
      pivot.rotation.z = x > 0 ? 0.07 : -0.07;
      this.body.add(pivot);
      return pivot;
    };
    this.armL = arm(0.245);
    this.armR = arm(-0.245);

    // head and face
    const head = new THREE.Group();
    head.position.set(0, 1.71, 0);
    this.head = head;
    this.body.add(head);
    head.add(mk(G.head, skin));
    const eyeM = mat(DARK, 0.4);
    for (const x of [-0.067, 0.067]) {
      const e = new THREE.Mesh(G.eye, eyeM);
      e.position.set(x, 0.02, 0.165);
      e.scale.set(1, 1.25, 0.6);
      head.add(e);
      const b = new THREE.Mesh(G.brow, hair);
      b.position.set(x, 0.085, 0.168);
      b.rotation.z = x > 0 ? -0.12 : 0.12;
      head.add(b);
    }
    const nose = new THREE.Mesh(G.nose, mat(darken(look.skin, 0.88), 0.65));
    nose.position.set(0, -0.025, 0.18);
    head.add(nose);
    const mouth = new THREE.Mesh(G.mouth, mat(darken(look.skin, 0.5), 0.6));
    mouth.position.set(0, -0.088, 0.162);
    head.add(mouth);

    this.buildHair(head, hair);
    this.buildAccessory(head);

    // generous invisible hit box so taps on people are easy
    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.9, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = 0.95;
    this.hit.userData.person = this;
    this.root.add(this.hit);

    batch(head);
    const sc = opts.scale ?? 1;
    this.root.scale.setScalar(sc);
  }

  private buildHair(head: THREE.Group, hair: THREE.Material) {
    const style = this.look.hair;
    const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      head.add(mesh);
      return mesh;
    };
    if (style === 'bald') return;
    if (style === 'cap') {
      const capM = mat(this.look.capColor ?? darken(this.look.clothes, 0.7), 0.8);
      add(G.hairBack, hair, 0, 0, -0.005);
      const top = add(G.capTop, capM, 0, 0.02, 0);
      top.rotation.x = -0.12;
      const brim = add(G.capBrim, capM, 0, 0.07, 0.17);
      brim.rotation.x = 0.12;
      return;
    }
    const cap = add(G.hairCap, hair, 0, 0.01, -0.012);
    cap.rotation.x = -0.3;
    add(G.hairBack, hair, 0, 0, 0);
    if (style === 'curly') {
      for (let k = 0; k < 11; k++) {
        const a = (k / 11) * Math.PI * 2;
        const c = add(G.curl, hair, Math.cos(a) * 0.17, 0.1 + Math.sin(k * 1.7) * 0.03, Math.sin(a) * 0.15 - 0.03);
        c.scale.setScalar(0.85 + (k % 3) * 0.12);
      }
      add(G.curl, hair, 0, 0.2, -0.02).scale.setScalar(1.3);
    } else if (style === 'bun') {
      add(G.bun, hair, 0, 0.17, -0.12);
    } else if (style === 'long') {
      const l = add(G.longHair, hair, 0, -0.16, -0.1);
      l.rotation.x = 0.08;
      for (const x of [-0.165, 0.165]) {
        const side = add(G.longHair, hair, x, -0.1, 0.0);
        side.scale.set(0.22, 0.85, 1.1);
      }
    } else if (style === 'ponytail') {
      const p = add(G.pony, hair, 0, -0.06, -0.22);
      p.rotation.x = 0.35;
      add(G.curl, hair, 0, 0.08, -0.19).scale.setScalar(0.7);
    }
  }

  private buildAccessory(head: THREE.Group) {
    const acc = this.look.accessory;
    if (!acc) return;
    if (acc === 'glasses') {
      const m = mat('#2b2b30', 0.4, 0.3);
      for (const x of [-0.068, 0.068]) {
        const l = new THREE.Mesh(G.lens, m);
        l.position.set(x, 0.02, 0.178);
        head.add(l);
      }
      const b = new THREE.Mesh(G.bridge, m);
      b.position.set(0, 0.025, 0.185);
      head.add(b);
    } else if (acc === 'hardhat') {
      const m = mat('#f2b632', 0.5);
      const h = new THREE.Mesh(G.hardhat, m);
      h.position.set(0, 0.03, 0);
      h.castShadow = true;
      head.add(h);
      const br = new THREE.Mesh(G.hatBrim, m);
      br.position.set(0, 0.04, 0.02);
      head.add(br);
    } else if (acc === 'apron') {
      const ap = new THREE.Mesh(G.apron, mat('#f1ede4', 0.95));
      ap.position.set(0, 1.08, 0.15);
      ap.castShadow = true;
      this.body.add(ap);
    } else if (acc === 'tie') {
      const t = new THREE.Mesh(G.tie, mat('#9b2c35', 0.6));
      t.position.set(0, 1.28, 0.145);
      t.rotation.x = -0.08;
      this.body.add(t);
    } else if (acc === 'clipboard') {
      const c = new THREE.Mesh(G.clip, mat('#9a7448', 0.7));
      c.position.set(-0.02, -0.46, 0.1);
      c.rotation.x = -0.5;
      this.armR.add(c);
    } else if (acc === 'phone') {
      const p = new THREE.Mesh(G.phone, mat('#18181c', 0.3, 0.2));
      p.position.set(0, -0.5, 0.07);
      p.rotation.x = -0.6;
      this.armR.add(p);
      this.armR.rotation.x = -0.9;
    } else if (acc === 'brooch' || acc === 'scissorsPin') {
      const b = new THREE.Mesh(G.brooch, mat(acc === 'brooch' ? '#d9b44a' : '#c9cdd2', 0.3, 0.8));
      b.position.set(0.09, 1.34, 0.15);
      this.body.add(b);
    }
  }

  get x() { return this.root.position.x; }
  get z() { return this.root.position.z; }

  place(x: number, z: number, heading = this.heading) {
    this.root.position.set(x, 0, z);
    this.heading = this.targetHeading = heading;
    this.root.rotation.y = heading;
  }

  face(x: number, z: number) {
    const dx = x - this.x, dz = z - this.z;
    if (dx * dx + dz * dz > 1e-4) this.targetHeading = Math.atan2(dx, dz);
  }

  faceHeading(h: number) { this.targetHeading = h; }

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

  /** Move along the path; `boxes` (optional) keeps free-walkers out of walls. */
  update(dt: number, groundY: (x: number, z: number) => number, boxes?: Box[]) {
    this.t += dt;
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

  /** Drive the rig: speed in m/s decides walk vs idle. */
  animate(dt: number, speed: number, groundY: (x: number, z: number) => number) {
    this.moving = speed > 0.15;
    // turn smoothly
    let dh = this.targetHeading - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * Math.min(1, dt * 10);
    this.root.rotation.y = this.heading;
    const gy = groundY(this.x, this.z);
    this.root.position.y += (gy - this.root.position.y) * Math.min(1, dt * 12);

    if (this.sitting) {
      this.body.position.y = this.sitHeight - 0.86;
      this.legL.rotation.x = this.legR.rotation.x = -Math.PI / 2 + 0.05;
      this.armL.rotation.x = this.armR.rotation.x = -0.45;
      this.torso.scale.y = 1 + Math.sin(this.t * 2) * 0.012;
    } else if (this.moving) {
      this.phase += dt * Math.min(speed, 4.5) * 4.2;
      const s = Math.sin(this.phase);
      const amp = Math.min(0.62, 0.3 + speed * 0.1);
      this.legL.rotation.x = s * amp;
      this.legR.rotation.x = -s * amp;
      this.armL.rotation.x = -s * amp * 0.8;
      if (this.look.accessory !== 'phone') this.armR.rotation.x = s * amp * 0.8;
      this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.045;
      this.torso.scale.y = 1;
    } else {
      const k = Math.min(1, dt * 8);
      this.legL.rotation.x += (0 - this.legL.rotation.x) * k;
      this.legR.rotation.x += (0 - this.legR.rotation.x) * k;
      this.armL.rotation.x += (Math.sin(this.t * 1.3) * 0.04 - this.armL.rotation.x) * k;
      if (this.look.accessory !== 'phone') this.armR.rotation.x += (-Math.sin(this.t * 1.3) * 0.04 - this.armR.rotation.x) * k;
      this.body.position.y += (0 - this.body.position.y) * k;
      this.torso.scale.y = 1 + Math.sin(this.t * 2) * 0.012;
    }

    // head turns toward a point of interest (within limits)
    let want = 0;
    if (this.lookTarget) {
      const dx = this.lookTarget.x - this.x, dz = this.lookTarget.z - this.z;
      let rel = Math.atan2(dx, dz) - this.heading;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      if (Math.abs(rel) < 1.6) want = Math.max(-0.9, Math.min(0.9, rel));
    }
    this.head.rotation.y += (want - this.head.rotation.y) * Math.min(1, dt * 6);
  }

  /** gesture while talking: small head nods */
  talk(dt: number) {
    this.head.rotation.x = Math.sin(this.t * 9) * 0.05;
  }
  quiet() { this.head.rotation.x = 0; }

  /** hands busy: wiping, serving, typing */
  work() {
    this.armL.rotation.x = -1.05 + Math.sin(this.t * 11) * 0.22;
    this.armR.rotation.x = -1.05 - Math.sin(this.t * 11) * 0.22;
    this.head.rotation.x = 0.25;
  }

  /** a wave hello */
  wave() {
    this.armR.rotation.x = -2.6;
    this.armR.rotation.z = -0.3 + Math.sin(this.t * 10) * 0.35;
  }
  rest() { this.armR.rotation.z = -0.07; this.head.rotation.x = 0; }

  dispose() {
    this.root.removeFromParent();
  }
}

const SKINS = ['#f3cfa8', '#e8b48c', '#d99a6c', '#c68863', '#a86a3f', '#8d5a3b', '#6e4632', '#5a3825'];
const HAIRS = ['#1a1512', '#2b2320', '#4a3122', '#6d4a2b', '#a9713d', '#c9a063', '#8a8a8a', '#d8d4cc', '#7a2f22'];
const CLOTHES = ['#3b5f8c', '#9b3d3d', '#3f7a5a', '#c48a2f', '#6b4f8f', '#2f6f7a', '#c25f7a', '#5c6670', '#d1c4a8', '#36404d', '#b9572f', '#7d8f45'];
const PANTS = ['#2d3440', '#3a3a3e', '#4b3d31', '#2c3e5c', '#5a5550', '#1f2328', '#6b6458'];
const STYLES: Look['hair'][] = ['short', 'curly', 'bun', 'long', 'cap', 'bald', 'ponytail', 'short', 'long'];

export function randomLook(rand = Math.random): Look {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const acc = rand() < 0.15 ? 'glasses' : rand() < 0.08 ? 'phone' : undefined;
  return {
    skin: pick(SKINS), hair: pick(STYLES), hairColor: pick(HAIRS), clothes: pick(CLOTHES),
    pants: pick(PANTS), accessory: acc as Look['accessory'],
  };
}
