// BizSim 3D: the original BizSim engine (economy, decision cards, rivals,
// 24-month run) driven from a walkable neighbourhood instead of menus.
import * as THREE from 'three';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { OutputPass } from './jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from './jsm/postprocessing/GTAOPass.js';
import { BUSINESSES, LOCATIONS, LOAN_AP, ADS_AP, MARKETING_TIERS, TIER_CAPACITY_MULT, businessOf } from '../../src/game/config';
import { CAST, CharacterId, OWNER_PRESETS, avatarLook } from '../../src/game/cast';
import { applyOption, drawCards, eventResponseLine } from '../../src/game/decisions';
import { borrow, endMonth, newGame, repay, scoreGame } from '../../src/game/engine';
import { ACTIVITIES, canDoActivity, canTakeBreak, doActivity, takeBreak } from '../../src/game/ops';
import { calendarMonth, monthName, monthOpen, monthRecap, yearOf } from '../../src/game/narration';
import { currentMenu, formatPrice } from '../../src/game/menu';
import { phaseDisplay } from '../../src/game/macro';
import type { DecisionCard, GameState, MarketingTier, Venue } from '../../src/game/types';
import { World, Seat, Spot, Home, HOMES, groundY, insideShop, BOUNDS } from './world';
import { Look, Person, randomLook, SKINS, HAIRS, OUTFITS, PANTS, STYLES } from './people';
import { CAR_COLORS, CarKind, makeCar } from './cars';
import { P2, collide } from './nav';
import * as ui from './ui';

const $ = ui.$;
const SAVE_KEY = 'bizsim3d.save.v1';
const PREF_KEY = 'bizsim3d.setup.v2';
const GFX_KEY = 'bizsim3d.gfx';
const WALK = 2.2, RUN = 4.8;

// ---------------- renderer, camera, post ----------------
const canvas = $<HTMLCanvasElement>('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.55;
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);

type Gfx = 'high' | 'fast';
const touchy = window.matchMedia('(pointer: coarse)').matches;
let gfx: Gfx = (() => {
  try { const v = localStorage.getItem(GFX_KEY); if (v === 'high' || v === 'fast') return v; } catch { /* storage unavailable */ }
  return !touchy && window.innerWidth >= 900 ? 'high' : 'fast';
})();
let composer: EffectComposer | null = null;
let renderPass: RenderPass | null = null;
let gtao: GTAOPass | null = null;

function buildComposer() {
  composer?.dispose();
  composer = null;
  if (gfx !== 'high' || !world) return;
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  renderPass = new RenderPass(world.scene, camera);
  composer.addPass(renderPass);
  gtao = new GTAOPass(world.scene, camera, w * pr, h * pr);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.9;
  gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
  // ambient occlusion at half resolution: most of the look for a fraction of the cost
  const g = gtao;
  g.setSize = (sw: number, sh: number) => GTAOPass.prototype.setSize.call(g, Math.max(1, sw * 0.5), Math.max(1, sh * 0.5));
  g.setSize(w * pr, h * pr);
  composer.addPass(gtao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.45, 0.92));
  composer.addPass(new OutputPass());
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
}

const cam = {
  yaw: 0.28, pitch: 0.62, dist: 13,
  target: new THREE.Vector3(0, 1, 1),
  focus: null as THREE.Vector3 | null,
  focusDist: 0,
  orbit: false,
};
let view: 'third' | 'first' = 'third';
let fpYaw = Math.PI, fpPitch = 0;

function resize() {
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.fov = view === 'first' ? 72 : camera.aspect < 0.8 ? 54 : 42;
  camera.near = view === 'first' ? 0.05 : 0.1;
  camera.updateProjectionMatrix();
  composer?.setSize(w, h);
}
window.addEventListener('resize', resize);

// ---------------- game objects ----------------
let world: World | null = null;
let state: GameState | null = null;
let mode: 'setup' | 'play' | 'end' = 'setup';
let player: Person | null = null;
let people: Person[] = [];
let tod = 0;
let busy: { t: number; done: () => void; face?: P2 } | null = null;
let pending: Inter | null = null;
let closing = false;
let repathT = 0;
let traveling = false;

interface CastNpc { id: CharacterId; p: Person; cards: number[]; home: Home; spot: Spot | null }
const cast = new Map<CharacterId, CastNpc>();
let staff: { p: Person; name: string; line: () => string; home: Spot }[] = [];
interface Customer { p: Person; stage: string; t: number; seat: Seat | null; q: number }
let customers: Customer[] = [];
let peds: { p: Person }[] = [];
interface Car { g: THREE.Group; axis: 'x' | 'z'; lane: number; dir: 1 | -1; speed: number; v: number; len: number; lightsF: THREE.Mesh[]; lightsR: THREE.Mesh[] }
let cars: Car[] = [];
let spawnT = 0;
let pedT = 0;
let signalT = 0;

// ---------------- persistence ----------------
const store = {
  get(key: string) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* storage unavailable */ } },
  del(key: string) { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } },
};
function save() { if (state && !state.gameOver) store.set(SAVE_KEY, JSON.stringify(state)); }
function loadSave(): GameState | null {
  const raw = store.get(SAVE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    return s && s.business && Array.isArray(s.history) && !s.gameOver ? s : null;
  } catch { return null; }
}

type Avatar = GameState['avatar'] & { look?: Look };
function ownerLook(s: GameState): Look {
  return (s.avatar as Avatar).look ?? { ...avatarLook(s.avatar), sleeves: 'long' };
}

// ---------------- world lifecycle ----------------
function shopNameFor(business: string, ownerName: string) {
  const noun: Record<string, string> = { restaurant: 'Kitchen', convenience: 'Corner Store', coffee: 'Coffee', bakery: 'Bakery', barber: 'Barbershop' };
  const n = ownerName.trim();
  return n ? `${n}'s ${noun[business]}`.toUpperCase() : businessOf(business).name.toUpperCase();
}

function buildWorld(business: GameState['business'], location: GameState['location'], ownerName: string) {
  if (world) world.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  const biz = businessOf(business);
  world = new World({ business, location, accent: biz.accent, shopName: shopNameFor(business, ownerName), tagline: LOCATIONS.find((l) => l.id === location)!.name });
  world.initEnv(renderer);
  world.firstPerson = view === 'first' && mode === 'play';
  document.documentElement.style.setProperty('--accent', biz.accent);
  people = [];
  cast.clear();
  staff = [];
  customers = [];
  peds = [];
  cars = [];
  $('labels').innerHTML = '';
  tags.clear();
  buildCars();
  mapBase = null;
  buildComposer();
  return world;
}

function addPerson(p: Person) {
  world!.scene.add(p.root);
  people.push(p);
  world!.clickables.push(p.hit);
  return p;
}
function removePerson(p: Person) {
  p.dispose();
  people = people.filter((q) => q !== p);
  const i = world!.clickables.indexOf(p.hit);
  if (i >= 0) world!.clickables.splice(i, 1);
  const t = tags.get(p.id);
  if (t) { t.remove(); tags.delete(p.id); }
}

function path(from: P2, to: P2) {
  return world!.nav.findPath(from.x, from.z, to.x, to.z) ?? [to];
}

// ---------------- traffic ----------------
const LANES = [
  { axis: 'x' as const, lane: 10, dir: 1 as const, stop: 30.2 },
  { axis: 'x' as const, lane: 6, dir: -1 as const, stop: 45.8 },
  { axis: 'z' as const, lane: 37, dir: 1 as const, stop: 0.4 },
  { axis: 'z' as const, lane: 39, dir: -1 as const, stop: 15.6 },
];
function buildCars() {
  const busy = state?.location === 'high' || mode === 'setup' ? 1 : state?.location === 'low' ? 0.5 : 0.75;
  const counts = [Math.round(5 * busy) + 1, Math.round(5 * busy) + 1, Math.round(3 * busy) + 1, Math.round(3 * busy) + 1];
  const kinds: CarKind[] = ['sedan', 'hatch', 'suv', 'sedan'];
  LANES.forEach((L, li) => {
    for (let i = 0; i < counts[li]; i++) {
      const c = makeCar(CAR_COLORS[(li * 3 + i * 7) % CAR_COLORS.length], kinds[(i + li) % kinds.length]);
      const g = c.group;
      g.rotation.y = L.axis === 'x' ? (L.dir === 1 ? 0 : Math.PI) : (L.dir === 1 ? -Math.PI / 2 : Math.PI / 2);
      const range = L.axis === 'x' ? 200 : 150;
      const along = -range / 2 + ((i + 0.3 * li) / counts[li]) * range + Math.random() * 6;
      if (L.axis === 'x') g.position.set(along, -0.12, L.lane); else g.position.set(L.lane, -0.12, along);
      world!.scene.add(g);
      const speed = 7.5 + Math.random() * 3;
      cars.push({ g, axis: L.axis, lane: L.lane, dir: L.dir, speed, v: speed, len: c.length, lightsF: c.lightsF, lightsR: c.lightsR });
    }
  });
}

function signalState(): { main: 'g' | 'y' | 'r'; oak: 'g' | 'y' | 'r' } {
  const t = signalT % 30;
  if (t < 13) return { main: 'g', oak: 'r' };
  if (t < 16) return { main: 'y', oak: 'r' };
  if (t < 17) return { main: 'r', oak: 'r' };
  if (t < 27) return { main: 'r', oak: 'g' };
  if (t < 29.5) return { main: 'r', oak: 'y' };
  return { main: 'r', oak: 'r' };
}

function updateCars(dt: number) {
  signalT += dt;
  const sig = signalState();
  world!.setSignals(sig.main, sig.oak);
  const night = Math.max(0, (tod - 0.7) / 0.3);
  for (const c of cars) {
    const pos = c.axis === 'x' ? c.g.position.x : c.g.position.z;
    const front = pos + c.dir * c.len / 2;
    let want = c.speed;
    // red light: ease to the stop line
    const L = LANES.find((l) => l.axis === c.axis && l.lane === c.lane)!;
    const light = c.axis === 'x' ? sig.main : sig.oak;
    const toStop = (L.stop - front) * c.dir;
    if (light !== 'g' && toStop > -0.3 && toStop < 30 && !(light === 'y' && toStop < 4)) want = Math.min(want, Math.max(0, toStop - 0.4) * 0.7);
    // yield to people in the lane ahead
    const ahead = (x: number, z: number) => {
      const lat = c.axis === 'x' ? z : x, lon = c.axis === 'x' ? x : z;
      const d = (lon - front) * c.dir;
      return Math.abs(lat - c.lane) < 1.7 && d > -0.5 && d < 7;
    };
    if (player && ahead(player.x, player.z)) want = 0;
    for (const p of people) if (p !== player && ahead(p.x, p.z)) { want = 0; break; }
    for (const o of cars) {
      if (o === c || o.axis !== c.axis || o.lane !== c.lane) continue;
      const op = c.axis === 'x' ? o.g.position.x : o.g.position.z;
      const gap = (op - pos) * c.dir - (o.len + c.len) / 2;
      if (gap > -1 && gap < 9) want = Math.min(want, Math.max(0, gap - 1.5) * 0.9, o.v);
    }
    c.v += (want - c.v) * Math.min(1, dt * (want < c.v ? 3.5 : 1.0));
    if (c.axis === 'x') {
      c.g.position.x += c.v * c.dir * dt;
      if (c.g.position.x * c.dir > 100) c.g.position.x = -100 * c.dir;
    } else {
      c.g.position.z += c.v * c.dir * dt;
      if (c.g.position.z * c.dir > (c.dir === 1 ? 80 : 70)) c.g.position.z = c.dir === 1 ? -70 : 80;
    }
    const brake = want < c.v - 0.3 || c.v < 0.3;
    for (const l of c.lightsF) (l.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + night * 3;
    for (const l of c.lightsR) (l.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + night * 1.5 + (brake ? 2.2 : 0);
  }
}

// ---------------- ambient people ----------------
const PED_ROUTES = [
  { a: { x: -68, z: 2.0 }, b: { x: 68, z: 2.0 } }, { a: { x: -68, z: 2.55 }, b: { x: 68, z: 2.55 } },
  { a: { x: -68, z: 13.2 }, b: { x: 68, z: 13.2 } }, { a: { x: -68, z: 13.65 }, b: { x: 68, z: 13.65 } },
  { a: { x: 32.0, z: -46 }, b: { x: 32.0, z: 52 } }, { a: { x: 32.6, z: -46 }, b: { x: 32.6, z: 52 } },
  { a: { x: 43.4, z: -46 }, b: { x: 43.4, z: 52 } }, { a: { x: 44.0, z: -46 }, b: { x: 44.0, z: 52 } },
];
function pedCap() {
  const loc = state?.location ?? 'average';
  return loc === 'low' ? 10 : loc === 'average' ? 16 : 24;
}
function spawnPed(anywhere = false) {
  const r = PED_ROUTES[Math.floor(Math.random() * PED_ROUTES.length)];
  const fwd = Math.random() < 0.5;
  const a = fwd ? r.a : r.b, b = fwd ? r.b : r.a;
  const p = addPerson(new Person(randomLook()));
  const t = anywhere ? Math.random() : 0;
  p.place(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, Math.atan2(b.x - a.x, b.z - a.z));
  p.speed = 1.15 + Math.random() * 0.4;
  p.walkTo([b]);
  peds.push({ p });
}

function crowdLevel() {
  if (!state) return 0.4;
  const last = state.history[state.history.length - 1];
  if (!last) return 0.35;
  const biz = businessOf(state.business);
  const cap = biz.baseCapacityPerDay * TIER_CAPACITY_MULT[state.storeTier - 1] * 30;
  return Math.max(0.08, Math.min(1, last.customers / cap));
}

function spawnCustomer() {
  const w = world!;
  const p = addPerson(new Person(randomLook()));
  const dir = Math.random() < 0.5 ? 1 : -1;
  const x0 = dir === 1 ? -30 : 30;
  p.place(x0, 2.0, dir === 1 ? Math.PI / 2 : -Math.PI / 2);
  p.speed = 1.25 + Math.random() * 0.3;
  const c: Customer = { p, stage: 'arrive', t: 0, seat: null, q: -1 };
  customers.push(c);
  p.walkTo([{ x: dir === 1 ? -0.8 : 0.8, z: 2.0 }], () => {
    const qi = freeQueue();
    if (qi < 0) { leaveCustomer(c); return; }
    c.q = qi;
    c.stage = 'toQueue';
    p.walkTo(path(p.root.position, w.queue[qi]), () => { c.stage = 'queue'; c.t = 2.5 + Math.random() * 3; p.faceHeading(Math.PI); });
  });
}
function freeQueue() {
  const used = new Set(customers.filter((c) => c.stage === 'toQueue' || c.stage === 'queue').map((c) => c.q));
  for (let i = 0; i < world!.queue.length; i++) if (!used.has(i)) return i;
  return -1;
}
function leaveCustomer(c: Customer) {
  c.stage = 'leave';
  if (c.seat) { c.seat.taken = false; c.seat = null; }
  c.p.sitting = false;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const out = world!.door.out;
  c.p.walkTo([...(insideShop(c.p.x, c.p.z) ? path(c.p.root.position, out) : []), { x: out.x + dir, z: 2.0 }, { x: 32 * dir, z: 2.0 }], () => { c.stage = 'gone'; });
}
function updateCustomers(dt: number) {
  const w = world!;
  for (const c of customers) {
    if (c.stage === 'queue') {
      c.t -= dt;
      if (c.t <= 0) {
        const seat = w.seats.find((s) => !s.taken && Math.random() < 0.85);
        if (seat && Math.random() < 0.8) {
          seat.taken = true;
          c.seat = seat;
          c.stage = 'toSeat';
          c.p.walkTo(path(c.p.root.position, seat.approach), () => {
            c.p.walkTo([{ x: seat.x, z: seat.z }], () => {
              if (seat.sit) { c.p.sitHeight = seat.y; c.p.sit(seat.h); } else c.p.faceHeading(seat.h);
              c.stage = 'seated';
              c.t = 9 + Math.random() * 12;
            });
          });
        } else leaveCustomer(c);
      }
    } else if (c.stage === 'seated') {
      c.t -= dt;
      if (c.t <= 0) {
        c.p.sitting = false;
        const s = c.seat!;
        c.p.place(s.approach.x, s.approach.z, c.p.heading);
        leaveCustomer(c);
      }
    }
  }
  for (const c of customers.filter((x) => x.stage === 'gone')) removePerson(c.p);
  customers = customers.filter((c) => c.stage !== 'gone');
  spawnT -= dt;
  const crowd = crowdLevel();
  if (spawnT <= 0 && !closing) {
    spawnT = 13 - crowd * 10 + Math.random() * 3;
    const inside = customers.filter((c) => c.stage !== 'leave').length;
    if (inside < Math.min(w.seats.length + 3, 4 + crowd * 10)) spawnCustomer();
  }
  updatePeds(dt);
}
function updatePeds(dt: number) {
  pedT -= dt;
  if (pedT <= 0) { pedT = 0.8 + Math.random() * 1.6; if (peds.length < pedCap()) spawnPed(); }
  for (const q of peds.filter((x) => !x.p.path.length)) removePerson(q.p);
  peds = peds.filter((q) => q.p.path.length);
}

// ---------------- staff ----------------
const STAFF_LINES = [
  (n: string) => `${n}: "Steady so far, boss. The lunch rush is coming."`,
  (n: string) => `${n}: "We're low on a couple of things. I'll flag it."`,
  (n: string) => `${n}: "Regulars keep asking when you're in. They like seeing you."`,
  (n: string) => `${n}: "All good back here."`,
];
function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(seed: number) { let s = seed || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; }

function buildStaff() {
  for (const s of staff) removePerson(s.p);
  staff = [];
  if (!state || !world) return;
  const w = world;
  const biz = businessOf(state.business);
  const uniform = new THREE.Color(biz.accent).multiplyScalar(0.55).getStyle();
  const team = state.roster.filter((m) => m.role !== 'manager');
  const spots = [...w.staffSpots.slice(0, state.business === 'barber' ? 1 : 3), ...w.backStaffSpots];
  team.slice(0, spots.length).forEach((m, i) => {
    const look: Look = { ...randomLook(seeded(hashStr(m.name))), clothes: uniform, accessory: 'apron', sleeves: 'short', bottom: 'pants' };
    const p = addPerson(new Person(look));
    const sp = spots[i];
    p.place(sp.x, sp.z, sp.h);
    staff.push({ p, name: m.name, home: sp, line: () => STAFF_LINES[Math.floor(Math.random() * STAFF_LINES.length)](m.name.split(' ')[0]) + ` (skill ${m.skill}, morale ${Math.round(m.morale)})` });
  });
  if (state.business === 'barber') {
    state.barbers.slice(0, 3).forEach((b, i) => {
      const z = [-4.8, -2.9, -1.0][i];
      const look: Look = { ...randomLook(seeded(hashStr(b.name))), clothes: '#2b2b2e', accessory: 'scissorsPin', bottom: 'pants' };
      const p = addPerson(new Person(look));
      const sp = { x: 4.95, z: z + 0.5, h: Math.PI / 2 };
      p.place(sp.x, sp.z, sp.h);
      staff.push({ p, name: b.name, home: sp, line: () => `${b.name.split(' ')[0]}: "Chair's paid up. Book's filling."` });
    });
  }
}

// ---------------- the cast ----------------
const CAST_EXTRA: Partial<Record<CharacterId, Partial<Look>>> = {
  regular: { bottom: 'skirt', height: 0.94 }, landlord: { bottom: 'skirt' }, influencer: { sleeves: 'short', height: 0.97 },
  accountant: { height: 0.97 }, inspector: { height: 1.0 }, banker: { height: 1.03, build: 1.08 }, neighbor: { sleeves: 'short', build: 1.15, height: 1.05 },
  contractor: { sleeves: 'short', build: 1.08 }, supplier: { build: 1.05 }, rival: { height: 1.04 }, manager: { sleeves: 'short' },
};
function castLook(id: CharacterId): Look {
  const c = CAST[id as Exclude<CharacterId, 'narrator'>];
  return { ...c.look, ...CAST_EXTRA[id] };
}

function settle(npc: CastNpc) {
  const h = npc.home;
  if (h.sit) { npc.p.sitHeight = h.sitY ?? 0.47; npc.p.sit(h.h); } else npc.p.faceHeading(h.h);
}

function ensureCast(id: CharacterId): CastNpc {
  let npc = cast.get(id);
  if (npc) return npc;
  const home = HOMES[id] ?? { x: 0, z: 3, h: 0 };
  const p = addPerson(new Person(castLook(id)));
  p.place(home.x, home.z, home.h);
  npc = { id, p, cards: [], home, spot: null };
  cast.set(id, npc);
  settle(npc);
  return npc;
}

function spawnCardCast() {
  if (!state || !world) return;
  const w = world;
  const used = new Map<Venue, number>();
  for (const id of Object.keys(HOMES) as CharacterId[]) ensureCast(id);
  state.currentCards.forEach((card, i) => {
    if (state!.completedCards.includes(i)) return;
    const speaker: CharacterId = card.speaker === 'narrator' ? 'manager' : card.speaker;
    const npc = ensureCast(speaker);
    npc.cards.push(i);
    if (npc.cards.length > 1) return;
    const venue: Venue = card.venue ?? 'inside';
    if (speaker === 'accountant' && venue === 'office') { npc.spot = null; return; }
    const k = used.get(venue) ?? 0;
    used.set(venue, k + 1);
    const list = w.spots[venue];
    const base = list[k % list.length];
    const sp = { x: base.x + Math.floor(k / list.length) * 0.8, z: base.z, h: base.h };
    npc.spot = sp;
    const p = npc.p;
    p.sitting = false;
    p.speed = 2.0;
    p.walkTo(path(p.root.position, sp), () => p.faceHeading(sp.h));
  });
}

function releaseNpc(npc: CastNpc) {
  const p = npc.p;
  p.speed = 1.5;
  npc.spot = null;
  const h = npc.home;
  if (Math.hypot(p.x - h.x, p.z - h.z) < 0.4) { settle(npc); return; }
  p.walkTo(path(p.root.position, h), () => settle(npc));
}

// ---------------- month flow ----------------
function applyWorldState() {
  if (!state || !world) return;
  world.setSeason(calendarMonth(state.month + 1));
  world.setRival(state.competitors[0]?.name ?? null);
  const m = currentMenu(state);
  world.setMenu(m.heading, m.lines.map((l) => ({ name: l.name, price: formatPrice(l.price), isNew: l.isNew })), m.note);
  world.setRenovating(state.renovationMonthsLeft > 0);
}

function startMonth(fresh: boolean) {
  if (!state || !world) return;
  if (!state.currentCards.length) {
    const cards = drawCards(state);
    const intro = monthOpen(state);
    state = { ...state, currentCards: cards, completedCards: [], monthIntro: intro, monthStory: [intro] };
    save();
  }
  applyWorldState();
  for (const npc of cast.values()) { npc.cards = []; npc.spot = null; npc.p.stop(); npc.p.place(npc.home.x, npc.home.z, npc.home.h); settle(npc); }
  for (const c of customers) removePerson(c.p);
  customers = [];
  for (const c of world.seats) c.taken = false;
  world.seats.filter((s) => s.x > 13).forEach((s) => (s.taken = true));
  buildStaff();
  spawnCardCast();
  tod = progress() * 0.85;
  world.setTime(tod);
  if (fresh && player) {
    player.place(0, 2.7, Math.PI);
    fpYaw = Math.PI; fpPitch = 0;
    cam.target.set(0, 1, 2.7);
  }
  ui.renderHud(state);
  refreshTasks();
  ui.slate(`${monthName(state.month + 1)}, year ${yearOf(state.month + 1)}`, state.monthIntro);
}

function progress() {
  if (!state || !state.currentCards.length) return 0;
  return state.completedCards.length / state.currentCards.length;
}

function venueName(v?: Venue) {
  return { street: 'Street', inside: 'Shop floor', back: 'Back room', office: 'Office' }[v ?? 'inside'];
}

function refreshTasks() {
  if (!state) return;
  const items: ui.TaskItem[] = state.currentCards.map((card, i) => {
    const speaker = card.speaker === 'narrator' ? 'manager' : card.speaker;
    const name = CAST[speaker as Exclude<CharacterId, 'narrator'>].name;
    const done = state!.completedCards.includes(i);
    return { label: name, where: venueName(card.venue), done, onClick: () => { const n = cast.get(speaker); if (n) goToPerson(n); } };
  });
  const left = state.currentCards.length - state.completedCards.length;
  items.push({ label: 'Close the month with Priya', where: 'Office', done: false, final: true, onClick: () => { const n = cast.get('accountant'); if (n) goToPerson(n); } });
  ui.renderTasks(items, left ? `${left} waiting on you` : 'Ready to close');
}

function finishCard(npc: CastNpc, idx: number) {
  if (!state) return;
  state = { ...state, completedCards: [...state.completedCards, idx] };
  npc.cards = npc.cards.filter((c) => c !== idx);
  save();
  if (!npc.cards.length) releaseNpc(npc);
  ui.renderHud(state);
  refreshTasks();
}

function playCard(npc: CastNpc) {
  if (!state) return;
  const idx = npc.cards[0];
  const card: DecisionCard = state.currentCards[idx];
  if (!card) return;
  const spec = ui.cardDialogSpec(card, state);
  startTalk(npc.p);
  ui.openDialog({
    ...spec,
    onLine: (on) => (on ? npc.p.talk() : npc.p.quiet()),
    onPick: (i) => {
      const before = state!;
      state = applyOption(state!, card, i);
      const delta = state.cash - before.cash;
      ui.renderHud(state);
      if (delta) ui.toast(`${delta > 0 ? 'Cash in' : 'Spent'} ${ui.money(Math.abs(delta))}`, delta > 0 ? 'good' : '');
      applyWorldState();
      const line = card.fromEvent ? eventResponseLine(card.id, i).line : card.options[i]?.result;
      return line || null;
    },
    onClose: () => { endTalk(); finishCard(npc, idx); },
  });
}

function closeMonthDialog(npc: CastNpc) {
  if (!state) return;
  const left = state.currentCards.length - state.completedCards.length;
  const name = monthName(state.month + 1);
  startTalk(npc.p);
  ui.openDialog({
    name: 'Priya', role: 'your accountant', color: CAST.accountant.look.clothes, title: 'Close the month',
    lines: left
      ? [`${left === 1 ? 'Someone is' : `${left} people are`} still waiting on a decision from you. Close ${name} anyway? Whatever you skip just doesn't happen.`]
      : [`Receipts are in, the till's counted. Ready to close out ${name}?`],
    options: [{ label: `Close ${name}`, hint: 'Run the month and read the numbers' }, { label: 'Not yet', hint: 'Keep working the shop' }],
    onLine: (on) => (on ? npc.p.talk() : npc.p.quiet()),
    onPick: (i) => { if (i === 0) setTimeout(closeMonth, 50); return null; },
    onClose: endTalk,
  });
}

function closeMonth() {
  if (!state || !world || closing) return;
  closing = true;
  exitPointerLock();
  const fade = $('fade');
  $('fadeText').textContent = 'Closing the books…';
  fade.classList.add('on');
  setTimeout(() => {
    const outcome = endMonth(state!);
    const story = monthRecap(outcome.record, outcome.state);
    state = outcome.state;
    for (const npc of cast.values()) if (npc.cards.length) { npc.cards = []; releaseNpc(npc); }
    refreshTasks();
    if (state.gameOver) store.del(SAVE_KEY); else save();
    fade.classList.remove('on');
    tod = 1;
    world!.setTime(1);
    ui.renderHud(state);
    const next = state.gameOver ? 'the results' : `${monthName(state.month + 1)}`;
    ui.openPanel(`${monthName(outcome.record.month)} closes`, ui.recapHtml(outcome, story, next), undefined, { noClose: true });
    $('recapGo').addEventListener('click', () => {
      ui.closePanel();
      closing = false;
      if (state!.gameOver) { showEnd(); return; }
      fade.classList.add('on');
      $('fadeText').textContent = `${monthName(state!.month + 1)}`;
      setTimeout(() => { startMonth(true); fade.classList.remove('on'); }, 700);
    });
  }, 750);
}

function showEnd() {
  if (!state) return;
  mode = 'end';
  exitPointerLock();
  const score = scoreGame(state);
  const el = $('end');
  el.innerHTML = ui.endHtml(state, score);
  el.hidden = false;
  for (const id of ['hud', 'tasks', 'minimap', 'crosshair']) $(id).hidden = true;
  $('endAgain').addEventListener('click', () => {
    el.hidden = true;
    store.del(SAVE_KEY);
    state = null;
    showSetup();
  });
}

// ---------------- talking ----------------
let talkPartner: Person | null = null;
function startTalk(p: Person) {
  if (!player) return;
  player.stop();
  pending = null;
  talkPartner = p;
  p.stop();
  if (!p.sitting) p.face(player.x, player.z);
  player.face(p.x, p.z);
  p.lookTarget = player.root.position;
  cam.focus = new THREE.Vector3((p.x + player.x) / 2, 1.35, (p.z + player.z) / 2);
  cam.focusDist = 6;
  exitPointerLock();
}
function endTalk() {
  if (talkPartner) { talkPartner.lookTarget = null; talkPartner.quiet(); }
  talkPartner = null;
  cam.focus = null;
}

function chat(p: Person, name: string, role: string, color: string, lines: string[]) {
  startTalk(p);
  p.wave();
  setTimeout(() => p.rest(), 1400);
  ui.openDialog({ name, role, color, lines, onLine: (on) => (on ? p.talk() : p.quiet()), onClose: endTalk });
}

function residentChat(npc: CastNpc) {
  if (!state) return;
  const s = state;
  const phase = phaseDisplay(s.macro.phase).label.toLowerCase();
  const c = CAST[npc.id as Exclude<CharacterId, 'narrator'>];
  const last = s.history[s.history.length - 1];
  const lines: Partial<Record<CharacterId, string[]>> = {
    neighbor: [
      s.macro.phase === 'boom' ? 'Memberships are flying out the door. People have money right now. Spend some of yours on the place while it lasts.' : s.macro.phase === 'recession' ? 'Cancellations every morning. Folks are tightening up. Watch your fixed costs, that\'s all I\'ll say.' : `Economy feels ${phase} from where I stand. Foot traffic past my door looks about the same as yours.`,
      s.reputation > 65 ? 'My members talk about your place after spin class. That\'s free advertising.' : 'Want a tip? Get out on the street and shake hands. The market square is where this block talks.',
    ],
    regular: [
      s.reputation > 70 ? 'Best spot on the block, dear. I tell everyone at bridge club.' : s.reputation < 40 ? 'I\'ll keep coming, dear. But people are talking, and not kindly. Fix it.' : 'Still settling in, aren\'t you? You\'ll find your feet.',
      s.fatigue > 55 ? 'Same things on offer every time I come in. Surprise me, would you?' : 'This bench is lovely this time of day. Come sit when you need to think.',
    ],
    banker: [
      s.loan ? `You owe us ${ui.money(s.loan)} at ${s.interestRate.toFixed(1)}%. Rates are drifting with the economy, which is ${phase}.` : `Your account is clean. If you need a line of credit, the door's open. Current rate is ${s.interestRate.toFixed(1)}%.`,
      'Walk into the branch any time to borrow or pay down. It takes a little groundwork on your end.',
    ],
    accountant: [last ? `Last month you ${last.profit >= 0 ? 'made' : 'lost'} ${ui.money(Math.abs(last.profit))}. The full breakdown is in the books.` : 'First month. I\'ll keep the receipts straight, you keep the customers happy.'],
    manager: [s.morale < 50 ? 'Team\'s worn thin, boss. A bonus or a lighter week would go a long way.' : 'Floor\'s covered. If you want to help, the kitchen could use hands at lunch.', `We've got ${s.staff} on the roster. Morale's around ${Math.round(s.morale)}.`],
    supplier: [s.supplierDealMonths > 0 ? `Your contract has ${s.supplierDealMonths} more months at the locked rate. Best deal on my route.` : 'Prices are moving with the economy. When I get a good contract to offer, you\'ll hear it first.', 'Truck\'s loaded for the restaurants down Oak. Busy week.'],
    contractor: [s.renovationMonthsLeft > 0 ? 'Your reno is on schedule. Mostly.' : `Your place is tier ${s.storeTier}. When you want to grow it, I'm the one you call.`, 'This frame goes up a floor a month if the steel shows up.'],
    inspector: [s.inspectionDue ? 'You\'re on my list this season. Keep the back room clean and the team staffed.' : 'Just walking the district. Clean kitchens make for quiet days.', `Your premises look about ${Math.round(s.condition)} out of 100 from the street.`],
    landlord: [`Rent's ${ui.money(s.rentCurrent)} a month on your lease, ${s.leaseMonthsLeft} months to go before it re-prices.`, 'I keep my buildings in good order. I expect the same from my tenants.'],
    influencer: [s.reputation > 60 ? 'Your place keeps popping up on my feed. People like it.' : 'I post where the vibe is. Make me want to post you.', 'This café has the best light on the block. Content gold.'],
    rival: [s.competitors.length ? `${s.competitors[0].name} is doing just fine, thanks for asking.` : 'Just looking around. Nice block. Lot of potential.', 'May the better shop win.'],
  };
  chat(npc.p, c.name, c.role, c.look.clothes, lines[npc.id] ?? ['Busy day. Talk later.']);
}

// ---------------- interactions ----------------
interface Inter { key: string; x: number; z: number; r: number; label: string; sub?: string; enabled: boolean; run: () => void; person?: Person; mesh?: THREE.Object3D; priority?: number }

function interFor(npc: CastNpc): Inter {
  const c = CAST[npc.id as Exclude<CharacterId, 'narrator'>];
  const p = npc.p;
  const card = npc.cards.length ? state!.currentCards[npc.cards[0]] : undefined;
  if (card) return { key: `cast:${npc.id}`, x: p.x, z: p.z, r: 1.7, label: `Talk to ${c.name}`, sub: card.title, enabled: true, run: () => playCard(npc), person: p, priority: 2 };
  if (npc.id === 'accountant') {
    const left = state!.currentCards.length - state!.completedCards.length;
    return { key: 'cast:accountant', x: p.x, z: p.z, r: 1.7, label: 'Close the month with Priya', sub: left ? `${left} still waiting` : 'Everything is handled', enabled: true, run: () => closeMonthDialog(npc), person: p, priority: 2 };
  }
  return { key: `cast:${npc.id}`, x: p.x, z: p.z, r: 1.6, label: `Chat with ${c.name}`, sub: c.role, enabled: true, run: () => residentChat(npc), person: p };
}

function activityInter(id: string, anchor: string): Inter | null {
  const a = world!.anchors[anchor];
  if (!a || !state) return null;
  const act = ACTIVITIES.find((x) => x.id === id)!;
  const ok = canDoActivity(state, id);
  return {
    key: id, x: a.x, z: a.z, r: a.r, mesh: a.mesh,
    label: act.label(state.business), sub: ok.ok ? act.hint : ok.why, enabled: ok.ok,
    run: () => {
      const check = canDoActivity(state!, id);
      if (!check.ok) { ui.toast(check.why!, 'bad'); return; }
      busy = {
        t: 1.6, face: { x: a.x, z: a.z },
        done: () => {
          const r = doActivity(state!, id);
          state = r.state;
          ui.toast(r.line, 'good');
          ui.renderHud(state);
          save();
        },
      };
    },
  };
}

function interactions(): Inter[] {
  if (!state || !world) return [];
  const w = world;
  const out: Inter[] = [];
  for (const npc of cast.values()) out.push(interFor(npc));
  for (const s of staff) out.push({ key: `staff:${s.name}`, x: s.p.x, z: s.p.z, r: 1.4, label: `Chat with ${s.name.split(' ')[0]}`, sub: 'your staff', enabled: true, person: s.p, run: () => chat(s.p, s.name, 'on your team', s.p.look.clothes, [s.line()]) });
  for (const [id, anchor] of [['serve', 'register'], ['clean', 'sink'], ['help', 'prep'], ['books', 'desk'], ['scout', 'rival'], ['network', 'market']] as [string, string][]) { const it = activityInter(id, anchor); if (it) out.push(it); }
  const menu = w.anchors.menu;
  out.push({ key: 'menu', x: menu.x, z: menu.z, r: menu.r, mesh: menu.mesh, label: 'Read the menu board', sub: 'what you charge', enabled: true, run: () => ui.openPanel(currentMenu(state!).heading, ui.menuHtml(state!)) });
  const bank = w.anchors.bank;
  out.push({ key: 'bank', x: bank.x, z: bank.z, r: bank.r, label: 'Walk into Civic Savings', sub: `borrow or repay · ${LOAN_AP} AP to borrow`, enabled: true, run: openBank });
  const ads = w.anchors.ads;
  out.push({ key: 'ads', x: ads.x, z: ads.z, r: ads.r, mesh: ads.mesh, label: 'Book an ad', sub: `now: ${MARKETING_TIERS.find((t) => t.id === state!.marketingTier)!.name}`, enabled: true, run: openAds });
  const bench = w.anchors.bench;
  const br = canTakeBreak(state);
  out.push({ key: 'bench', x: bench.x, z: bench.z, r: bench.r, mesh: bench.mesh, label: 'Take a real break', sub: br.ok ? 'full energy; your manager runs the shop' : br.why, enabled: br.ok, run: () => {
    const check = canTakeBreak(state!);
    if (!check.ok) { ui.toast(check.why!, 'bad'); return; }
    state = takeBreak(state!);
    ui.toast('You actually rested. Full tank.', 'good');
    ui.renderHud(state);
    save();
  } });
  return out;
}

function openBank() {
  exitPointerLock();
  const render = () => {
    const el = ui.openPanel('Civic Savings', ui.bankHtml(state!));
    el.querySelector('#bankBorrow')?.addEventListener('click', () => {
      if (state!.ap < LOAN_AP) return;
      state = { ...borrow(state!), ap: state!.ap - LOAN_AP };
      ui.toast(`Borrowed ${ui.money(5000)}`, 'good');
      ui.renderHud(state); save(); render();
    });
    el.querySelector('#bankRepay')?.addEventListener('click', () => {
      state = repay(state!);
      ui.toast('Paid down the loan', 'good');
      ui.renderHud(state); save(); render();
    });
  };
  render();
}

function openAds() {
  exitPointerLock();
  const render = () => {
    const el = ui.openPanel('Advertising', ui.adsHtml(state!));
    el.querySelectorAll<HTMLButtonElement>('[data-tier]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.tier as MarketingTier;
      const t = MARKETING_TIERS.find((x) => x.id === id)!;
      const needsAp = t.cost > 0 && state!.marketingTier !== id;
      if (needsAp && state!.ap < ADS_AP) return;
      state = { ...state!, marketingTier: id, ap: state!.ap - (needsAp ? ADS_AP : 0) };
      ui.toast(id === 'none' ? 'Ads switched off' : `${t.name} booked`, 'good');
      ui.renderHud(state); save(); render();
    }));
  };
  render();
}

let nearest: Inter | null = null;
function updatePrompt() {
  const el = $<HTMLButtonElement>('prompt');
  if (!player || ui.dialogOpen || ui.panelOpen || busy || mode !== 'play' || traveling) { el.hidden = true; nearest = null; return; }
  let best: Inter | null = null;
  let bestScore = Infinity;
  const fx = Math.sin(fpYaw), fz = Math.cos(fpYaw);
  for (const it of interactions()) {
    const dx = it.x - player.x, dz = it.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > it.r) continue;
    let score = d - (it.priority ?? 0) * 0.6;
    // in first person, prefer what you are looking at
    if (view === 'first' && d > 0.01) score -= ((dx * fx + dz * fz) / d) * 0.8;
    if (score < bestScore) { bestScore = score; best = it; }
  }
  if (best?.key !== nearest?.key || (best && nearest && (best.sub !== nearest.sub || best.label !== nearest.label))) {
    if (best) {
      el.innerHTML = `<kbd>E</kbd><span>${best.label}</span>${best.sub ? `<small>${best.sub}</small>` : ''}`;
      el.classList.toggle('off', !best.enabled);
    }
  }
  nearest = best;
  el.hidden = !best;
}

function goTo(it: Inter) {
  if (!player || ui.dialogOpen || ui.panelOpen || busy) return;
  if (Math.hypot(player.x - it.x, player.z - it.z) <= it.r * 0.9) { it.run(); return; }
  pending = it;
  const far = Math.hypot(player.x - it.x, player.z - it.z) > 14;
  player.speed = far ? RUN : WALK;
  player.walkTo(path(player.root.position, { x: it.x, z: it.z }));
}

/** Walk to someone nearby; jump straight to them if they are across the map. */
function goToPerson(npc: CastNpc) {
  if (!player) return;
  const d = Math.hypot(player.x - npc.p.x, player.z - npc.p.z);
  if (d < 22) { goTo(interFor(npc)); return; }
  const p = npc.p;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const free = world!.nav.nearestFree(p.x + fx * 1.2, p.z + fz * 1.2);
  const x = free ? world!.nav.wx(free[0]) : p.x + fx * 1.2;
  const z = free ? world!.nav.wz(free[1]) : p.z + fz * 1.2;
  travelTo({ id: 'person', name: CAST[npc.id as Exclude<CharacterId, 'narrator'>].name, x, z, h: Math.atan2(p.x - x, p.z - z) }, () => goTo(interFor(npc)));
}

// ---------------- fast travel & map ----------------
function travelTo(place: { name: string; x: number; z: number; h: number }, after?: () => void) {
  if (!player || !world || ui.dialogOpen || closing || traveling) return;
  traveling = true;
  ui.closeMap();
  const fade = $('fade');
  $('fadeText').textContent = `Heading to ${place.name}`;
  fade.classList.add('on');
  setTimeout(() => {
    player!.stop();
    pending = null;
    player!.place(place.x, place.z, place.h);
    fpYaw = place.h;
    fpPitch = 0;
    cam.target.set(place.x, 1, place.z);
    cam.yaw = place.h + Math.PI;
    fade.classList.remove('on');
    traveling = false;
    after?.();
  }, 520);
}

let mapBase: HTMLCanvasElement | null = null;
const MAPPAD = 4;
function mapExtent() { return { x0: BOUNDS.x0 - MAPPAD, z0: BOUNDS.z0 - MAPPAD, x1: BOUNDS.x1 + MAPPAD, z1: BOUNDS.z1 + MAPPAD }; }
const MAP_COLORS: Record<string, string> = { road: '#3c434b', walk: '#8d9296', building: '#c9bfae', park: '#7aa05a', lot: '#57606a', site: '#a58a62', shop: '' };

/** Paint the static part of the map once per world. */
function paintMapBase(scale: number) {
  const e = mapExtent();
  const c = document.createElement('canvas');
  c.width = Math.ceil((e.x1 - e.x0) * scale);
  c.height = Math.ceil((e.z1 - e.z0) * scale);
  const g = c.getContext('2d')!;
  g.fillStyle = '#d9d4c7';
  g.fillRect(0, 0, c.width, c.height);
  const rect = (r: { x0: number; z0: number; x1: number; z1: number }, color: string) => {
    g.fillStyle = color;
    g.fillRect((r.x0 - e.x0) * scale, (r.z0 - e.z0) * scale, (r.x1 - r.x0) * scale, (r.z1 - r.z0) * scale);
  };
  const order = ['walk', 'road', 'park', 'lot', 'site', 'building', 'shop'];
  for (const k of order) for (const r of world!.mapRects) if (r.kind === k) rect(r, k === 'shop' ? businessOf(world!.opts.business).accent : MAP_COLORS[k]);
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 1;
  for (const r of world!.mapRects) if (r.kind === 'building' || r.kind === 'shop') g.strokeRect((r.x0 - e.x0) * scale + 0.5, (r.z0 - e.z0) * scale + 0.5, (r.x1 - r.x0) * scale - 1, (r.z1 - r.z0) * scale - 1);
  return c;
}

function markers() {
  const out: { x: number; z: number; kind: 'need' | 'close' | 'you' }[] = [];
  for (const npc of cast.values()) {
    if (npc.cards.length && state?.currentCards[npc.cards[0]]) out.push({ x: npc.p.x, z: npc.p.z, kind: 'need' });
    else if (npc.id === 'accountant') out.push({ x: npc.p.x, z: npc.p.z, kind: 'close' });
  }
  return out;
}

function drawMarker(g: CanvasRenderingContext2D, x: number, y: number, kind: string, s: number) {
  g.beginPath();
  if (kind === 'need') { g.fillStyle = '#ff8a3d'; g.arc(x, y, 5 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1b1208'; g.font = `800 ${8 * s}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', x, y + 0.5); }
  else if (kind === 'close') { g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#f2b632'; g.fillRect(x - 4.5 * s, y - 4.5 * s, 9 * s, 9 * s); g.fillStyle = '#1b1208'; g.font = `800 ${8 * s}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', x, y + 0.5); }
}

function drawYou(g: CanvasRenderingContext2D, x: number, y: number, heading: number, s: number) {
  g.save();
  g.translate(x, y);
  g.rotate(-heading + Math.PI);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#131a21';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -7 * s); g.lineTo(5 * s, 6 * s); g.lineTo(0, 3 * s); g.lineTo(-5 * s, 6 * s); g.closePath();
  g.stroke(); g.fill();
  g.restore();
}

function updateMinimap() {
  const mm = $<HTMLCanvasElement>('minimap');
  if (mm.hidden || !world || !player) return;
  const W = mm.width, H = mm.height;
  const scale = 2.2;
  if (!mapBase) mapBase = paintMapBase(scale);
  const e = mapExtent();
  const g = mm.getContext('2d')!;
  const px = (player.x - e.x0) * scale, pz = (player.z - e.z0) * scale;
  g.fillStyle = '#d9d4c7';
  g.fillRect(0, 0, W, H);
  g.drawImage(mapBase, W / 2 - px, H / 2 - pz);
  for (const m of markers()) drawMarker(g, W / 2 + (m.x - player.x) * scale, H / 2 + (m.z - player.z) * scale, m.kind, 1);
  drawYou(g, W / 2, H / 2, view === 'first' ? fpYaw : player.heading, 1);
}

function openMap() {
  if (!world || !player || mode !== 'play' || ui.dialogOpen) return;
  exitPointerLock();
  $('help').hidden = true;
  const scale = 4;
  const base = paintMapBase(scale);
  const e = mapExtent();
  const el = ui.openMap(world.places.map((p) => ({ id: p.id, name: p.name })), (id) => {
    const p = world!.places.find((q) => q.id === id);
    if (p) travelTo(p);
  });
  const cv = el.querySelector('canvas') as HTMLCanvasElement;
  cv.width = base.width;
  cv.height = base.height;
  const g = cv.getContext('2d')!;
  const draw = () => {
    g.drawImage(base, 0, 0);
    g.font = '600 13px "Atkinson Hyperlegible", system-ui';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const p of world!.places) {
      const x = (p.x - e.x0) * scale, y = (p.z - e.z0) * scale;
      g.fillStyle = '#131a21';
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f1ede3'; g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
    }
    g.font = '600 11px "Atkinson Hyperlegible", system-ui';
    for (const r of world!.mapRects) if (r.label) {
      const x = ((r.x0 + r.x1) / 2 - e.x0) * scale, y = ((r.z0 + r.z1) / 2 - e.z0) * scale;
      if (g.measureText(r.label).width > (r.x1 - r.x0) * scale - 4) continue;
      g.fillStyle = 'rgba(19,26,33,0.8)';
      g.fillText(r.label, x, y);
    }
    g.fillStyle = 'rgba(19,26,33,0.55)';
    g.font = '700 12px system-ui';
    g.fillText('MAIN ST', (-50 - e.x0) * scale, (8 - e.z0) * scale);
    g.save(); g.translate((38 - e.x0) * scale, (-30 - e.z0) * scale); g.rotate(-Math.PI / 2); g.fillText('OAK AVE', 0, 0); g.restore();
    for (const m of markers()) drawMarker(g, (m.x - e.x0) * scale, (m.z - e.z0) * scale, m.kind, 1.5);
    drawYou(g, (player!.x - e.x0) * scale, (player!.z - e.z0) * scale, view === 'first' ? fpYaw : player!.heading, 1.5);
  };
  draw();
  cv.addEventListener('click', (ev) => {
    const r = cv.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * cv.width / scale + e.x0;
    const z = ((ev.clientY - r.top) / r.height) * cv.height / scale + e.z0;
    let best = world!.places[0], bd = Infinity;
    for (const p of world!.places) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    if (bd < 9) travelTo(best);
  });
}

// ---------------- view mode ----------------
function setView(v: 'third' | 'first') {
  view = v;
  if (world) world.firstPerson = v === 'first';
  if (player) player.setVisible(v === 'third');
  if (v === 'first' && player) { fpYaw = player.heading; fpPitch = 0; }
  if (v === 'third') { exitPointerLock(); cam.yaw = fpYaw + Math.PI; }
  $('crosshair').hidden = v !== 'first' || mode !== 'play';
  $('btnView').textContent = v === 'first' ? '3rd person' : '1st person';
  $('btnView').setAttribute('aria-pressed', String(v === 'first'));
  if (world) world.setTime(tod);
  resize();
}
function exitPointerLock() { if (document.pointerLockElement) document.exitPointerLock?.(); }
document.addEventListener('pointerlockchange', () => { $('lockHint').hidden = !(view === 'first' && mode === 'play' && !document.pointerLockElement && !touchy); });

// ---------------- input ----------------
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'shift') keys.add('shift');
  if (mode === 'play' && !ui.dialogOpen) {
    if (k === 'escape' && (ui.panelOpen || ui.mapOpen)) { e.preventDefault(); ui.closePanel(); ui.closeMap(); return; }
    if (ui.panelOpen || ui.mapOpen) { if (k === 'm' && ui.mapOpen) ui.closeMap(); return; }
    if ((k === 'e' || k === 'enter' || k === ' ') && nearest) { e.preventDefault(); nearest.run(); return; }
    if (k === 'b') { openBooks(); return; }
    if (k === 'm') { openMap(); return; }
    if (k === 'v') { setView(view === 'first' ? 'third' : 'first'); return; }
  }
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

const pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
let dragged = false;
let pinch0 = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (document.pointerLockElement === canvas) return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
  dragged = false;
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
});
canvas.addEventListener('pointermove', (e) => {
  if (document.pointerLockElement === canvas) {
    if (ui.dialogOpen || ui.panelOpen) return;
    fpYaw -= e.movementX * 0.0024;
    fpPitch = Math.max(-1.3, Math.min(1.3, fpPitch - e.movementY * 0.0024));
    return;
  }
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch0 && view === 'third') cam.dist = clampDist(cam.dist * (pinch0 / d));
    pinch0 = d;
    dragged = true;
    return;
  }
  if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 7) dragged = true;
  if (dragged && mode === 'play') {
    if (view === 'first') {
      fpYaw -= dx * 0.005;
      fpPitch = Math.max(-1.3, Math.min(1.3, fpPitch - dy * 0.004));
    } else {
      cam.yaw -= dx * 0.0065;
      cam.pitch = Math.max(0.22, Math.min(1.35, cam.pitch + dy * 0.004));
    }
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (document.pointerLockElement === canvas) {
    if (mode === 'play' && e.button === 0) clickCenter();
    return;
  }
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch0 = 0;
  if (!p || dragged || mode !== 'play' || e.button > 0) return;
  if (view === 'first' && !touchy && !ui.dialogOpen && !ui.panelOpen) {
    canvas.requestPointerLock?.();
    return;
  }
  click(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (view === 'third') cam.dist = clampDist(cam.dist * (1 + Math.sign(e.deltaY) * 0.1)); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
const clampDist = (d: number) => Math.max(3.5, Math.min(30, d));

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickAt(nx: number, ny: number): Inter | null {
  if (!world) return null;
  ndc.set(nx, ny);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(world.clickables.filter((o) => o.visible !== false && o !== player?.hit), true);
  const all = interactions();
  for (const h of hits.slice(0, 3)) {
    let o: THREE.Object3D | null = h.object;
    while (o) {
      const person = o.userData.person as Person | undefined;
      const it = all.find((i) => (person && i.person === person) || (!person && i.mesh === o));
      if (it) return it;
      if (person) break;
      o = o.parent;
    }
  }
  return null;
}
function clickCenter() {
  if (!player || ui.dialogOpen || ui.panelOpen || busy) return;
  const it = pickAt(0, 0);
  if (it) goTo(it);
  else if (nearest) nearest.run();
}
function click(cx: number, cy: number) {
  if (!world || !player || ui.dialogOpen || ui.panelOpen || busy) return;
  const r = canvas.getBoundingClientRect();
  const nx = ((cx - r.left) / r.width) * 2 - 1, ny = -((cy - r.top) / r.height) * 2 + 1;
  const it = pickAt(nx, ny);
  if (it) { goTo(it); return; }
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pt = new THREE.Vector3();
  if (ray.ray.intersectPlane(plane, pt)) {
    pending = null;
    const x = Math.max(BOUNDS.x0 + 0.5, Math.min(BOUNDS.x1 - 0.5, pt.x));
    const z = Math.max(BOUNDS.z0 + 0.5, Math.min(BOUNDS.z1 - 0.5, pt.z));
    player.speed = Math.hypot(x - player.x, z - player.z) > 14 ? RUN : WALK;
    player.walkTo(path(player.root.position, { x, z }));
    marker(x, z);
  }
}

let markerMesh: THREE.Mesh | null = null;
let markerT = 0;
function marker(x: number, z: number) {
  if (!world) return;
  if (!markerMesh) markerMesh = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
  world.scene.add(markerMesh);
  markerMesh.position.set(x, groundY(x, z) + 0.03, z);
  markerT = 0.8;
}

$('prompt').addEventListener('click', () => nearest?.run());
$('btnBooks').addEventListener('click', () => openBooks());
$('btnMap').addEventListener('click', () => openMap());
$('minimap').addEventListener('click', () => openMap());
$('btnView').addEventListener('click', () => setView(view === 'first' ? 'third' : 'first'));
$('btnHelp').addEventListener('click', () => {
  const h = $('help');
  h.hidden = !h.hidden;
  $('btnHelp').setAttribute('aria-expanded', String(!h.hidden));
  $('btnGfx').textContent = `Graphics: ${gfx === 'high' ? 'High' : 'Fast'}`;
});
$('btnGfx').addEventListener('click', () => {
  gfx = gfx === 'high' ? 'fast' : 'high';
  store.set(GFX_KEY, gfx);
  $('btnGfx').textContent = `Graphics: ${gfx === 'high' ? 'High' : 'Fast'}`;
  buildComposer();
});
$('btnTitle').addEventListener('click', () => {
  if (mode !== 'play' || ui.dialogOpen || closing) return;
  save();
  ui.closePanel();
  state = null;
  showSetup();
});
$('tasksToggle').addEventListener('click', () => {
  const t = $('tasks');
  t.classList.toggle('min');
  const min = t.classList.contains('min');
  $('tasksToggle').textContent = min ? 'Show' : 'Hide';
  $('tasksToggle').setAttribute('aria-expanded', String(!min));
});
function openBooks() { if (state && mode === 'play' && !ui.dialogOpen) { exitPointerLock(); ui.openPanel(`The books · ${monthName(state.month + 1)}`, ui.booksHtml(state)); } }

// ---------------- name tags ----------------
const tags = new Map<number, HTMLDivElement>();
const v3 = new THREE.Vector3();
function updateTags() {
  if (!world || mode !== 'play' || !state || !player) { for (const t of tags.values()) t.hidden = true; return; }
  const seen = new Set<number>();
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const show = (p: Person, html: string, cls: string, onClick: () => void) => {
    seen.add(p.id);
    let el = tags.get(p.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'tag';
      el.addEventListener('click', () => (el as HTMLDivElement & { go?: () => void }).go?.());
      $('labels').appendChild(el);
      tags.set(p.id, el);
    }
    (el as HTMLDivElement & { go?: () => void }).go = onClick;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    el.className = `tag ${cls}`;
    v3.set(p.x, p.root.position.y + (p.sitting ? 1.55 : 2.0) * p.scale, p.z).project(camera);
    const vis = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
    el.hidden = !vis || ui.dialogOpen || traveling;
    if (vis) el.style.transform = `translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h}px) translate(-50%, -100%)`;
  };
  const range = view === 'first' ? 18 : 30;
  for (const npc of cast.values()) {
    const c = CAST[npc.id as Exclude<CharacterId, 'narrator'>];
    const d = Math.hypot(npc.p.x - player.x, npc.p.z - player.z);
    const done = state.completedCards.length >= state.currentCards.length;
    if (npc.cards.length && state.currentCards[npc.cards[0]]) { if (d < 60) show(npc.p, `<span class="bang">!</span>${c.name}`, '', () => goToPerson(npc)); }
    else if (npc.id === 'accountant' && d < 40) show(npc.p, `${done ? '<span class="bang" style="background:var(--accent)">$</span>' : ''}Priya`, done ? '' : 'quiet', () => goToPerson(npc));
    else if (d < Math.min(range, 10)) show(npc.p, c.name, 'quiet', () => goTo(interFor(npc)));
  }
  for (const s of staff) if (Math.hypot(s.p.x - player.x, s.p.z - player.z) < 5) show(s.p, s.name.split(' ')[0], 'quiet', () => { const it = interactions().find((i) => i.person === s.p); if (it) goTo(it); });
  for (const [id, el] of tags) if (!seen.has(id)) el.hidden = true;
}

// ---------------- camera helpers ----------------
/** Pull the third-person camera in front of any building between it and the player. */
function occludedDist(target: THREE.Vector3, yaw: number, pitch: number, dist: number) {
  if (!world || !player) return dist;
  const occ = insideShop(player.x, player.z) ? world.occluders : [...world.occluders, world.shopOccluder];
  const dx = Math.sin(yaw) * Math.cos(pitch), dz = Math.cos(yaw) * Math.cos(pitch), dy = Math.sin(pitch);
  for (let i = 1; i <= 28; i++) {
    const t = (i / 28) * dist;
    const x = target.x + dx * t, z = target.z + dz * t, y = target.y + dy * t;
    for (const b of occ) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y < b.h) return Math.max(2.2, t - 0.8);
  }
  return dist;
}

// ---------------- main loop ----------------
const clock = new THREE.Clock();
const MAX_DT = (window as unknown as { __maxDt?: number }).__maxDt ?? 0.05;
const fwd = new THREE.Vector3();
let curDist = 13, curPitch = 0.62;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(MAX_DT, clock.getDelta());
  if (!world) return;
  const w = world;

  if (player && mode === 'play') {
    let mx = 0, mz = 0;
    if (!ui.dialogOpen && !ui.panelOpen && !ui.mapOpen && !busy && !traveling) {
      if (keys.has('w') || keys.has('arrowup')) mz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) mz += 1;
      if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
      if (keys.has('d') || keys.has('arrowright')) mx += 1;
    }
    if (mx || mz) {
      pending = null;
      player.stop();
      const len = Math.hypot(mx, mz);
      const yaw = view === 'first' ? fpYaw + Math.PI : cam.yaw;
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      const dx = (mx * cy + mz * sy) / len, dz = (-mx * sy + mz * cy) / len;
      const sp = keys.has('shift') ? RUN : WALK + 0.6;
      const p = { x: player.x + dx * sp * dt, z: player.z + dz * sp * dt };
      collide(p, 0.28, w.colliders);
      for (const o of people) {
        if (o === player) continue;
        const ox = p.x - o.x, oz = p.z - o.z, d = Math.hypot(ox, oz);
        if (d < 0.52 && d > 1e-4) { p.x = o.x + (ox / d) * 0.52; p.z = o.z + (oz / d) * 0.52; }
      }
      const moved = Math.hypot(p.x - player.x, p.z - player.z);
      if (view === 'first') player.setHeading(fpYaw); else player.face(p.x, p.z);
      player.root.position.x = p.x;
      player.root.position.z = p.z;
      player.animate(dt, moved / dt, groundY);
    } else {
      player.update(dt, groundY, w.colliders);
      if (view === 'first' && player.path.length) {
        // look where you're walking
        let d = player.heading - fpYaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        fpYaw += d * Math.min(1, dt * 4);
      } else if (view === 'first' && !talkPartner) player.setHeading(fpYaw);
    }
    if (pending?.person) {
      const tp = pending.person;
      pending.x = tp.x; pending.z = tp.z;
      repathT -= dt;
      if (repathT <= 0 && Math.hypot(player.x - tp.x, player.z - tp.z) > pending.r * 0.85) {
        repathT = 0.6;
        player.speed = Math.hypot(player.x - tp.x, player.z - tp.z) > 4 ? RUN : WALK;
        player.walkTo(path(player.root.position, { x: tp.x, z: tp.z }));
      }
    }
    if (pending && Math.hypot(player.x - pending.x, player.z - pending.z) <= pending.r * 0.85) {
      const it = pending;
      pending = null;
      player.stop();
      it.run();
    } else if (pending && !player.path.length) pending = null;
    if (busy) {
      if (busy.face) { player.face(busy.face.x, busy.face.z); if (view === 'first') { const want = Math.atan2(busy.face.x - player.x, busy.face.z - player.z); fpYaw += Math.atan2(Math.sin(want - fpYaw), Math.cos(want - fpYaw)) * Math.min(1, dt * 5); } }
      player.work();
      busy.t -= dt;
      if (busy.t <= 0) { const b = busy; busy = null; player.quiet(); b.done(); }
    }
  }
  for (const p of people) if (p !== player) p.update(dt, groundY);
  if (state && mode === 'play') updateCustomers(dt);
  else if (mode === 'setup') updatePeds(dt);
  updateCars(dt);

  if (state && mode === 'play') {
    const want = forceTod ?? (closing ? 1 : 0.05 + progress() * 0.78);
    tod += (want - tod) * Math.min(1, dt * 0.6);
    w.setTime(tod);
  }

  // camera
  if (mode === 'play' && player && view === 'first') {
    if (talkPartner) {
      const hx = talkPartner.x - player.x, hz = talkPartner.z - player.z;
      const want = Math.atan2(hx, hz);
      fpYaw += Math.atan2(Math.sin(want - fpYaw), Math.cos(want - fpYaw)) * Math.min(1, dt * 5);
      const eyeT = talkPartner.root.position.y + (talkPartner.sitting ? 1.2 : 1.6) * talkPartner.scale;
      const wantP = Math.atan2(eyeT - player.eyeHeight, Math.hypot(hx, hz));
      fpPitch += (wantP - fpPitch) * Math.min(1, dt * 5);
    }
    const eye = player.eyeHeight;
    const lx = Math.sin(fpYaw) * Math.cos(fpPitch), lz = Math.cos(fpYaw) * Math.cos(fpPitch), ly = Math.sin(fpPitch);
    camera.position.set(player.x + Math.sin(fpYaw) * 0.12, eye, player.z + Math.cos(fpYaw) * 0.12);
    camera.lookAt(camera.position.x + lx, camera.position.y + ly, camera.position.z + lz);
    cam.target.set(player.x, 1, player.z);
  } else {
    if (mode === 'play' && player) {
      const goal = cam.focus ?? new THREE.Vector3(player.x, 1.1, player.z);
      cam.target.lerp(goal, Math.min(1, dt * (cam.focus ? 3 : 7)));
    } else if (cam.orbit) {
      cam.yaw = 0.35 + Math.sin(performance.now() * 0.00008) * 0.55;
    }
    let dist = cam.focus ? Math.min(cam.dist, cam.focusDist) : cam.dist;
    const pitch = cam.focus ? Math.min(cam.pitch, 0.45) : cam.pitch;
    if (mode === 'play') dist = occludedDist(cam.target, cam.yaw, pitch, dist);
    curDist += (dist - curDist) * Math.min(1, dt * (dist < curDist ? 10 : 3));
    curPitch += (pitch - curPitch) * Math.min(1, dt * 4);
    fwd.set(Math.sin(cam.yaw) * Math.cos(curPitch), Math.sin(curPitch), Math.cos(cam.yaw) * Math.cos(curPitch));
    camera.position.copy(cam.target).addScaledVector(fwd, curDist);
    camera.lookAt(cam.target);
  }

  if (markerMesh && markerT > 0) {
    markerT -= dt;
    (markerMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, markerT);
    markerMesh.scale.setScalar(1 + (0.8 - markerT) * 0.6);
    if (markerT <= 0) markerMesh.removeFromParent();
  }

  const pInside = !!player && mode === 'play' && insideShop(player.x, player.z);
  w.update(dt, cam.target, camera.position, pInside, player ? player.root.position : cam.target);
  camera.updateMatrixWorld();
  updatePrompt();
  updateTags();
  minimapT -= dt;
  if (minimapT <= 0) { minimapT = 0.1; updateMinimap(); }
  if (composer && gfx === 'high') composer.render(dt); else renderer.render(w.scene, camera);
}
let minimapT = 0;
let forceTod: number | null = null;

// ---------------- setup screen ----------------
interface Sel { business: GameState['business']; location: GameState['location']; look: Look; name: string }
const PRESET_LOOKS: Look[] = [
  ...OWNER_PRESETS.map((p) => ({ ...p.look, accessory: undefined, sleeves: 'long' as const, pants: '#2d3440' })),
  { skin: '#a86a45', hair: 'long', hairColor: '#14100e', clothes: '#c25f7a', pants: '#1f2328', sleeves: 'short', bottom: 'pants' },
  { skin: '#f6d5b8', hair: 'bun', hairColor: '#d1a866', clothes: '#2f6f7a', pants: '#5a5550', sleeves: 'long', bottom: 'skirt' },
  { skin: '#4f3122', hair: 'bald', hairColor: '#14100e', clothes: '#d1c4a8', pants: '#3a3a3e', sleeves: 'short' },
];
const sel: Sel = { business: 'coffee', location: 'average', look: { ...PRESET_LOOKS[0] }, name: '' };
try { const raw = JSON.parse(store.get(PREF_KEY) ?? '{}'); Object.assign(sel, raw); } catch { /* ignore */ }
if (!BUSINESSES.some((b) => b.id === sel.business)) sel.business = 'coffee';
if (!LOCATIONS.some((l) => l.id === sel.location)) sel.location = 'average';
let previewOwner: Person | null = null;
let portraits: string[] = [];

/** Render small head-and-shoulders portraits of the preset looks. */
function renderPortraits() {
  if (portraits.length) return;
  const size = 160;
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a3642');
  scene.add(new THREE.HemisphereLight('#ffffff', '#55606a', 1.6));
  const key = new THREE.DirectionalLight('#fff4e6', 2.4);
  key.position.set(1.5, 2.5, 3);
  scene.add(key);
  const cam2 = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  cam2.position.set(0.25, 1.62, 1.55);
  cam2.lookAt(0, 1.52, 0);
  const buf = new Uint8Array(size * size * 4);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  for (const look of PRESET_LOOKS) {
    const p = new Person({ ...look, height: 1 });
    p.place(0, 0, 0.25);
    p.animate(0.016, 0, () => 0);
    scene.add(p.root);
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam2);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    g.putImageData(img, 0, 0);
    portraits.push(cv.toDataURL('image/png'));
    scene.remove(p.root);
  }
  renderer.setRenderTarget(null);
  rt.dispose();
}

function showSetup() {
  mode = 'setup';
  closing = false;
  busy = null;
  pending = null;
  cam.focus = null;
  cam.orbit = true;
  cam.pitch = 0.3;
  cam.dist = 9.5;
  cam.target.set(1.2, 1.7, 2.4);
  exitPointerLock();
  for (const id of ['hud', 'tasks', 'help', 'prompt', 'slate', 'minimap', 'crosshair', 'lockHint']) $(id).hidden = true;
  ui.closeMap();
  if (view === 'first') { view = 'third'; resize(); }
  rebuildPreview();
  renderSetup();
}

function rebuildPreview() {
  buildWorld(sel.business, sel.location, sel.name || '');
  player = null;
  placePreviewOwner();
  world!.setTime(0.3);
  world!.setSeason(3);
  for (let i = 0; i < 8; i++) spawnPed(true);
}
function placePreviewOwner() {
  if (previewOwner) removePerson(previewOwner);
  previewOwner = addPerson(new Person(sel.look));
  previewOwner.place(1.6, 2.5, 0.35);
}

function renderSetup() {
  renderPortraits();
  const el = $('setup');
  el.innerHTML = ui.setupHtml(sel, !!loadSave(), portraits, PRESET_LOOKS, { skins: SKINS, hairs: HAIRS, outfits: OUTFITS, styles: STYLES as string[] });
  el.hidden = false;
  const persist = () => store.set(PREF_KEY, JSON.stringify(sel));
  const rerender = (rebuild: boolean) => { persist(); if (rebuild) rebuildPreview(); renderSetup(); };
  const relook = () => { persist(); placePreviewOwner(); renderSetup(); };
  el.querySelectorAll<HTMLButtonElement>('[data-biz]').forEach((b) => b.addEventListener('click', () => { sel.business = b.dataset.biz as Sel['business']; rerender(true); }));
  el.querySelectorAll<HTMLButtonElement>('[data-loc]').forEach((b) => b.addEventListener('click', () => { sel.location = b.dataset.loc as Sel['location']; rerender(true); }));
  el.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => b.addEventListener('click', () => { sel.look = { ...PRESET_LOOKS[Number(b.dataset.preset)] }; relook(); }));
  el.querySelectorAll<HTMLButtonElement>('[data-skin]').forEach((b) => b.addEventListener('click', () => { sel.look = { ...sel.look, skin: b.dataset.skin! }; relook(); }));
  el.querySelectorAll<HTMLButtonElement>('[data-hair]').forEach((b) => b.addEventListener('click', () => { sel.look = { ...sel.look, hair: b.dataset.hair as Look['hair'] }; relook(); }));
  el.querySelectorAll<HTMLButtonElement>('[data-haircolor]').forEach((b) => b.addEventListener('click', () => { sel.look = { ...sel.look, hairColor: b.dataset.haircolor! }; relook(); }));
  el.querySelectorAll<HTMLButtonElement>('[data-outfit]').forEach((b) => b.addEventListener('click', () => { sel.look = { ...sel.look, clothes: b.dataset.outfit!, pants: PANTS[OUTFITS.indexOf(b.dataset.outfit!) % PANTS.length] }; relook(); }));
  const nameIn = $<HTMLInputElement>('ownerName');
  const startBtn = $<HTMLButtonElement>('startRun');
  const check = () => { const ok = nameIn.value.trim().length > 0; startBtn.disabled = !ok; $('nameHint').hidden = ok; };
  check();
  nameIn.addEventListener('input', check);
  nameIn.addEventListener('change', () => { sel.name = nameIn.value.trim(); persist(); buildWorld(sel.business, sel.location, sel.name); placePreviewOwner(); world!.setTime(0.3); world!.setSeason(3); for (let i = 0; i < 8; i++) spawnPed(true); });
  startBtn.addEventListener('click', () => {
    sel.name = nameIn.value.trim();
    if (!sel.name) { nameIn.focus(); return; }
    persist();
    const avatar: Avatar = { skin: 0, hair: 0, hairColor: 0, look: { ...sel.look } };
    beginPlay(newGame(sel.business, sel.location, sel.name, avatar), true);
  });
  $('continueRun')?.addEventListener('click', () => { const s = loadSave(); if (s) beginPlay(s, false); });
}

function beginPlay(s: GameState, fresh: boolean) {
  state = s;
  $('setup').hidden = true;
  const fade = $('fade');
  $('fadeText').textContent = fresh ? 'Opening day' : 'Back to work';
  fade.classList.add('on');
  setTimeout(() => {
    mode = 'play';
    buildWorld(s.business, s.location, s.ownerName);
    previewOwner = null;
    cam.orbit = false;
    cam.pitch = 0.62;
    cam.dist = 13;
    cam.yaw = 0.25;
    player = addPerson(new Person(ownerLook(s)));
    player.speed = WALK;
    player.place(0, 2.7, Math.PI);
    cam.target.set(0, 1, 2.7);
    curDist = cam.dist; curPitch = cam.pitch;
    for (let i = 0; i < pedCap() * 0.7; i++) spawnPed(true);
    $('hud').hidden = false;
    $('tasks').hidden = false;
    if (window.innerWidth < 640) { $('tasks').classList.add('min'); $('tasksToggle').textContent = 'Show'; $('tasksToggle').setAttribute('aria-expanded', 'false'); }
    $('minimap').hidden = window.innerWidth < 700;
    setView(view);
    startMonth(true);
    if (fresh) setTimeout(() => { $('help').hidden = false; $('btnHelp').setAttribute('aria-expanded', 'true'); $('btnGfx').textContent = `Graphics: ${gfx === 'high' ? 'High' : 'Fast'}`; setTimeout(() => ($('help').hidden = true), 14000); }, 400);
    fade.classList.remove('on');
    canvas.focus({ preventScroll: true });
  }, 650);
}

// ---------------- boot ----------------
declare global {
  interface Window { claude?: { hot?: { snapshot?: (fn: () => unknown) => void; ready?: (fn: (d: unknown) => void) => void; data?: unknown } } }
}

async function boot(data: unknown) {
  resize();
  try { await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]); } catch { /* fonts are optional */ }
  $('loading').hidden = true;
  frame();
  const hot = data as { state?: GameState } | null;
  if (hot?.state && !hot.state.gameOver) beginPlay(hot.state, false);
  else showSetup();
}

window.claude?.hot?.snapshot?.(() => ({ state: mode === 'play' ? state : null }));
if ((window as unknown as { __maxDt?: number }).__maxDt) {
  (window as unknown as Record<string, unknown>).__bizsim = { player: () => player, state: () => state, world: () => world, cam, setView, travelTo, openMap, cars: () => cars, tod: (t: number | null) => { forceTod = t; } };
}
const hot = window.claude?.hot;
if (hot?.ready) hot.ready((d) => boot(d)); else boot(hot?.data ?? null);
