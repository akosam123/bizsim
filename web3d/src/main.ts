// BizSim 3D: the original BizSim engine (economy, decision cards, rivals,
// 24-month run) driven from a walkable 3D block instead of menus.
import * as THREE from 'three';
import { BUSINESSES, LOCATIONS, LOAN_AP, ADS_AP, MARKETING_TIERS, TIER_CAPACITY_MULT, businessOf } from '../../src/game/config';
import { CAST, CharacterId, OWNER_PRESETS, avatarLook } from '../../src/game/cast';
import { applyOption, drawCards, eventResponseLine } from '../../src/game/decisions';
import { borrow, endMonth, newGame, repay, scoreGame } from '../../src/game/engine';
import { ACTIVITIES, canDoActivity, canTakeBreak, doActivity, takeBreak } from '../../src/game/ops';
import { calendarMonth, monthName, monthOpen, monthRecap, yearOf } from '../../src/game/narration';
import { currentMenu, formatPrice } from '../../src/game/menu';
import { phaseDisplay } from '../../src/game/macro';
import type { DecisionCard, GameState, MarketingTier, Venue } from '../../src/game/types';
import { World, Seat, Spot, groundY, insideShop, roomOf, BOUNDS } from './world';
import { Look, Person, mat, randomLook } from './people';
import { P2, collide } from './nav';
import * as ui from './ui';

const $ = ui.$;
const SAVE_KEY = 'bizsim3d.save.v1';
const PREF_KEY = 'bizsim3d.setup.v1';

// ---------------- renderer & camera ----------------
const canvas = $<HTMLCanvasElement>('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 800);

const cam = {
  yaw: 0.28, pitch: 0.8, dist: 15,
  target: new THREE.Vector3(0, 1, 1),
  focus: null as THREE.Vector3 | null,
  focusDist: 0,
  orbit: false, // setup screen: slow orbit
};

function resize() {
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.fov = camera.aspect < 0.8 ? 52 : 40;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------------- game objects ----------------
let world: World | null = null;
let state: GameState | null = null;
let mode: 'setup' | 'play' | 'end' = 'setup';
let player: Person | null = null;
let people: Person[] = [];
let tod = 0; // time of day shown
let busy: { t: number; done: () => void; face?: P2 } | null = null;
let pending: Inter | null = null;
let closing = false;
let repathT = 0;

interface CastNpc {
  id: CharacterId;
  p: Person;
  cards: number[];          // indices into state.currentCards still waiting
  resident: boolean;
  home: Spot & { sit?: boolean; sitY?: number };
  leaving: boolean;
  spot: Spot | null;
}
const cast = new Map<CharacterId, CastNpc>();
let staff: { p: Person; name: string; line: () => string; home: Spot }[] = [];

interface Customer { p: Person; stage: string; t: number; seat: Seat | null; q: number }
let customers: Customer[] = [];
let peds: { p: Person; dir: number }[] = [];
interface Car { g: THREE.Group; lane: number; dir: number; speed: number; v: number; lights: THREE.Mesh[] }
let cars: Car[] = [];
let spawnT = 0;
let pedT = 0;

const RESIDENTS: Partial<Record<CharacterId, { x: number; z: number; h: number; sit?: boolean; sitY?: number }>> = {
  accountant: { x: 4.4, z: -9.45, h: Math.PI, sit: true, sitY: 0.5 },
  neighbor: { x: 16.2, z: 3.25, h: -2.5 },
  regular: { x: 13.45, z: 19.0, h: Math.PI / 2, sit: true, sitY: 0.5 },
  banker: { x: -12.7, z: 3.25, h: 2.5 },
};

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

// ---------------- world lifecycle ----------------
function shopNameFor(s: { business: string; ownerName: string }) {
  const biz = businessOf(s.business);
  const n = s.ownerName.trim();
  const noun: Record<string, string> = { restaurant: 'Kitchen', convenience: 'Corner Store', coffee: 'Coffee', bakery: 'Bakery', barber: 'Barbershop' };
  return n ? `${n}'s ${noun[biz.id]}`.toUpperCase() : biz.name.toUpperCase();
}

function buildWorld(business: GameState['business'], location: GameState['location'], ownerName: string) {
  if (world) {
    world.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
  const biz = businessOf(business);
  world = new World({ business, location, accent: biz.accent, shopName: shopNameFor({ business, ownerName }), tagline: LOCATIONS.find((l) => l.id === location)!.name });
  document.documentElement.style.setProperty('--accent', biz.accent);
  people = [];
  cast.clear();
  staff = [];
  customers = [];
  peds = [];
  cars = [];
  ui.$('labels').innerHTML = '';
  tags.clear();
  buildCars();
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

// ---------------- cars ----------------
function buildCars() {
  const colors = ['#c8312e', '#2f5d9c', '#e8e4da', '#2b2e31', '#d9a43a', '#4f7a5a', '#8a8f96'];
  const n = state?.location === 'high' || mode === 'setup' ? 7 : state?.location === 'low' ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const body = mat(colors[i % colors.length], 0.35, 0.3);
    const dark = mat('#20262c', 0.2, 0.4);
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      b.castShadow = true;
      g.add(b);
      return b;
    };
    const long = i % 3 === 0;
    box(long ? 4.6 : 3.9, 0.65, 1.75, body, 0, 0.55, 0);
    box(long ? 2.6 : 2.1, 0.55, 1.6, dark, -0.15, 1.12, 0);
    box(long ? 2.5 : 2.0, 0.08, 1.62, body, -0.15, 1.42, 0);
    const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14).rotateX(Math.PI / 2);
    for (const [x, z] of [[-1.25, 0.82], [1.25, 0.82], [-1.25, -0.82], [1.25, -0.82]]) {
      const w = new THREE.Mesh(wheel, mat('#1a1a1a', 0.8));
      w.position.set(x * (long ? 1.15 : 1), 0.34, z);
      g.add(w);
    }
    const lightM = new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#ffe9b0', emissiveIntensity: 0.3 });
    const tailM = new THREE.MeshStandardMaterial({ color: '#7a1010', emissive: '#ff2a1a', emissiveIntensity: 0.3 });
    const half = (long ? 4.6 : 3.9) / 2;
    const lights = [box(0.05, 0.18, 0.35, lightM, half, 0.62, 0.55), box(0.05, 0.18, 0.35, lightM, half, 0.62, -0.55), box(0.05, 0.16, 0.3, tailM, -half, 0.66, 0.6), box(0.05, 0.16, 0.3, tailM, -half, 0.66, -0.6)];
    const dir = i % 2 ? 1 : -1;
    g.rotation.y = dir === 1 ? 0 : Math.PI;
    const lane = dir === 1 ? 10.0 : 6.0;
    g.position.set(-70 + Math.random() * 140, -0.12, lane);
    world!.scene.add(g);
    const speed = 7 + Math.random() * 3;
    cars.push({ g, lane, dir, speed, v: speed, lights });
  }
}

function updateCars(dt: number) {
  for (const c of cars) {
    let want = c.speed;
    // brake for anyone in the lane ahead
    const ahead = (x: number, z: number) => Math.abs(z - c.lane) < 1.9 && (x - c.g.position.x) * c.dir > 1.5 && (x - c.g.position.x) * c.dir < 9;
    if (player && ahead(player.x, player.z)) want = 0;
    for (const p of people) if (ahead(p.x, p.z) && p !== player) want = 0;
    for (const o of cars) {
      if (o === c || o.lane !== c.lane) continue;
      const d = (o.g.position.x - c.g.position.x) * c.dir;
      if (d > 0 && d < 7) want = Math.min(want, o.v * 0.9);
    }
    c.v += (want - c.v) * Math.min(1, dt * (want < c.v ? 4 : 1.2));
    c.g.position.x += c.v * c.dir * dt;
    if (c.g.position.x * c.dir > 75) c.g.position.x = -75 * c.dir;
    const night = Math.max(0, (tod - 0.7) / 0.3);
    (c.lights[0].material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + night * 2.5;
    (c.lights[2].material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + night * 1.5 + (want < c.v - 0.5 ? 1.5 : 0);
  }
}

// ---------------- ambient people ----------------
function pedCap() {
  const loc = state?.location ?? 'average';
  return loc === 'low' ? 5 : loc === 'average' ? 8 : 13;
}

function spawnPed() {
  const p = addPerson(new Person(randomLook()));
  const north = Math.random() < 0.55;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const lane = north ? (Math.random() < 0.5 ? 1.75 : 2.35) : (Math.random() < 0.5 ? 13.2 : 13.65);
  const x0 = dir === 1 ? -30 : 30;
  p.place(x0 + Math.random() * 4 * dir, lane, dir === 1 ? Math.PI / 2 : -Math.PI / 2);
  p.speed = 1.1 + Math.random() * 0.5;
  p.walkTo([{ x: -x0, z: lane }]);
  peds.push({ p, dir });
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
  const x0 = dir === 1 ? -26 : 26;
  p.place(x0, 1.75, dir === 1 ? Math.PI / 2 : -Math.PI / 2);
  p.speed = 1.3 + Math.random() * 0.3;
  const c: Customer = { p, stage: 'arrive', t: 0, seat: null, q: -1 };
  customers.push(c);
  p.walkTo([{ x: dir === 1 ? -0.8 : 0.8, z: 1.75 }], () => {
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
  c.p.walkTo([...(insideShop(c.p.x, c.p.z) ? path(c.p.root.position, out) : []), { x: out.x + dir, z: 1.75 }, { x: 30 * dir, z: 1.75 }], () => { c.stage = 'gone'; });
}

function updateCustomers(dt: number) {
  const w = world!;
  for (const c of customers) {
    if (c.stage === 'queue') {
      c.t -= dt;
      // the person at the front faces the till
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
  const gone = customers.filter((c) => c.stage === 'gone');
  for (const c of gone) removePerson(c.p);
  customers = customers.filter((c) => c.stage !== 'gone');

  // spawn: busier shops get more walk-ins
  spawnT -= dt;
  const crowd = crowdLevel();
  if (spawnT <= 0 && !closing) {
    spawnT = 13 - crowd * 10 + Math.random() * 3;
    const inside = customers.filter((c) => c.stage !== 'leave').length;
    if (inside < Math.min(w.seats.length + 3, 4 + crowd * 10)) spawnCustomer();
  }
  pedT -= dt;
  if (pedT <= 0) {
    pedT = 1.2 + Math.random() * 2;
    if (peds.length < pedCap()) spawnPed();
  }
  const done = peds.filter((q) => !q.p.path.length);
  for (const q of done) removePerson(q.p);
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
    const look: Look = { ...randomLook(seeded(hashStr(m.name))), clothes: uniform, accessory: 'apron' };
    const p = addPerson(new Person(look));
    const sp = spots[i];
    p.place(sp.x, sp.z, sp.h);
    staff.push({ p, name: m.name, home: sp, line: () => STAFF_LINES[Math.floor(Math.random() * STAFF_LINES.length)](m.name.split(' ')[0]) + ` (skill ${m.skill}, morale ${Math.round(m.morale)})` });
  });
  if (state.business === 'barber') {
    state.barbers.slice(0, 3).forEach((b, i) => {
      const z = [-4.8, -2.9, -1.0][i];
      const look: Look = { ...randomLook(seeded(hashStr(b.name))), clothes: '#2b2b2e', accessory: 'scissorsPin' };
      const p = addPerson(new Person(look));
      const sp = { x: 4.95, z: z + 0.5, h: Math.PI / 2 };
      p.place(sp.x, sp.z, sp.h);
      staff.push({ p, name: b.name, home: sp, line: () => `${b.name.split(' ')[0]}: "Chair's paid up. Book's filling."` });
    });
  }
}

// ---------------- the cast ----------------
function castLook(id: CharacterId): Look {
  const c = CAST[id as Exclude<CharacterId, 'narrator'>];
  return { ...c.look };
}

function ensureCast(id: CharacterId): CastNpc {
  let npc = cast.get(id);
  if (npc) return npc;
  const res = RESIDENTS[id];
  const p = addPerson(new Person(castLook(id)));
  const home = res ? { x: res.x, z: res.z, h: res.h, sit: res.sit, sitY: res.sitY } : { x: -22.4, z: 2.0, h: Math.PI / 2 };
  if (res) {
    p.place(home.x, home.z, home.h);
    if (home.sit) { p.sitHeight = home.sitY ?? 0.47; p.sit(home.h); }
  }
  npc = { id, p, cards: [], resident: !!res, home, leaving: false, spot: null };
  cast.set(id, npc);
  return npc;
}

function spawnCardCast() {
  if (!state || !world) return;
  const w = world;
  const used = new Map<Venue, number>();
  // residents always exist
  for (const id of Object.keys(RESIDENTS) as CharacterId[]) ensureCast(id);
  state.currentCards.forEach((card, i) => {
    if (state!.completedCards.includes(i)) return;
    const speaker: CharacterId = card.speaker === 'narrator' ? 'manager' : card.speaker;
    const npc = ensureCast(speaker);
    npc.cards.push(i);
    if (npc.cards.length > 1) return; // already placed for an earlier scene
    const venue: Venue = card.venue ?? 'inside';
    // Priya taking a meeting in her own office stays in her chair
    if (speaker === 'accountant' && venue === 'office') { npc.spot = null; return; }
    const k = used.get(venue) ?? 0;
    used.set(venue, k + 1);
    const list = w.spots[venue];
    const base = list[k % list.length];
    const sp = { x: base.x + Math.floor(k / list.length) * 0.8, z: base.z, h: base.h };
    npc.spot = sp;
    const p = npc.p;
    if (!npc.resident && speaker === 'manager') {
      p.place(sp.x, sp.z, sp.h);
    } else {
      if (!npc.resident) {
        const fromLeft = sp.x < 0 || Math.random() < 0.5;
        p.place(fromLeft ? -22.4 : 24.4, 1.9, fromLeft ? Math.PI / 2 : -Math.PI / 2);
      }
      p.sitting = false;
      p.speed = 2.1;
      p.walkTo(path(p.root.position, sp), () => p.faceHeading(sp.h));
    }
  });
}

function releaseNpc(npc: CastNpc) {
  const p = npc.p;
  p.speed = 1.6;
  npc.spot = null;
  if (npc.resident) {
    const h = npc.home;
    if (Math.hypot(p.x - h.x, p.z - h.z) < 0.4) return;
    p.walkTo(path(p.root.position, h), () => {
      if (h.sit) { p.sitHeight = h.sitY ?? 0.47; p.sit(h.h); } else p.faceHeading(h.h);
    });
  } else {
    npc.leaving = true;
    const out = world!.door.out;
    const dir = p.x < 0 ? -1 : 1;
    p.walkTo([...(insideShop(p.x, p.z) ? path(p.root.position, out) : path(p.root.position, { x: p.x, z: 1.9 })), { x: 27 * dir, z: 1.9 }], () => {
      removePerson(p);
      cast.delete(npc.id);
    });
  }
}

// ---------------- month flow ----------------
function applyWorldState() {
  if (!state || !world) return;
  const cal = calendarMonth(state.month + 1);
  world.setSeason(cal);
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
  // clear old month cast (residents stay)
  for (const npc of [...cast.values()]) {
    npc.cards = [];
    if (!npc.resident) { removePerson(npc.p); cast.delete(npc.id); }
    else { const h = npc.home; npc.p.place(h.x, h.z, h.h); if (h.sit) { npc.p.sitHeight = h.sitY ?? 0.47; npc.p.sit(h.h); } }
  }
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
    return { label: name, where: venueName(card.venue), done, onClick: () => { const n = cast.get(speaker); if (n) goTo(interFor(n)); } };
  });
  const left = state.currentCards.length - state.completedCards.length;
  items.push({ label: 'Close the month with Priya', where: 'Office', done: false, final: true, onClick: () => { const n = cast.get('accountant'); if (n) goTo(interFor(n)); } });
  ui.renderTasks(items, left ? `${left} waiting on you` : 'Ready to close');
}

function finishCard(npc: CastNpc, idx: number) {
  if (!state) return;
  state = { ...state, completedCards: [...state.completedCards, idx] };
  npc.cards = npc.cards.filter((c) => c !== idx);
  save();
  if (!npc.cards.length) releaseNpc(npc);
  else {
    // a second scene with the same person: they stay put
  }
  ui.renderHud(state);
  refreshTasks();
}

function playCard(npc: CastNpc) {
  if (!state) return;
  const idx = npc.cards[0];
  const card: DecisionCard = state.currentCards[idx];
  const spec = ui.cardDialogSpec(card, state);
  startTalk(npc.p);
  ui.openDialog({
    ...spec,
    onLine: (on) => (talking = on ? npc.p : null),
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
    onLine: (on) => (talking = on ? npc.p : null),
    onPick: (i) => {
      if (i === 0) setTimeout(closeMonth, 50);
      return null;
    },
    onClose: endTalk,
  });
}

function closeMonth() {
  if (!state || !world || closing) return;
  closing = true;
  const fade = $('fade');
  $('fadeText').textContent = 'Closing the books…';
  fade.classList.add('on');
  setTimeout(() => {
    const outcome = endMonth(state!);
    const story = monthRecap(outcome.record, outcome.state);
    state = outcome.state;
    // anyone still waiting goes home; the month is over
    for (const npc of [...cast.values()]) if (npc.cards.length) { npc.cards = []; releaseNpc(npc); }
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
  const score = scoreGame(state);
  const el = $('end');
  el.innerHTML = ui.endHtml(state, score);
  el.hidden = false;
  $('hud').hidden = true;
  $('tasks').hidden = true;
  $('endAgain').addEventListener('click', () => {
    el.hidden = true;
    store.del(SAVE_KEY);
    state = null;
    showSetup();
  });
}

// ---------------- talking ----------------
let talking: Person | null = null;
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
  cam.focus = new THREE.Vector3((p.x + player.x) / 2, 1.3, (p.z + player.z) / 2);
  cam.focusDist = 7.5;
}
function endTalk() {
  if (talkPartner) { talkPartner.lookTarget = null; talkPartner.quiet(); }
  talkPartner = null;
  talking = null;
  cam.focus = null;
}

function chat(p: Person, name: string, role: string, color: string, lines: string[]) {
  startTalk(p);
  p.wave();
  setTimeout(() => p.rest(), 1400);
  ui.openDialog({ name, role, color, lines, onLine: (on) => (talking = on ? p : null), onClose: endTalk });
}

function residentChat(npc: CastNpc) {
  if (!state) return;
  const s = state;
  const phase = phaseDisplay(s.macro.phase).label.toLowerCase();
  const c = CAST[npc.id as Exclude<CharacterId, 'narrator'>];
  const lines: Record<string, string[]> = {
    neighbor: [
      s.macro.phase === 'boom' ? 'Memberships are flying out the door. People have money right now. Spend some of yours on the place while it lasts.' : s.macro.phase === 'recession' ? 'Cancellations every morning. Folks are tightening up. Watch your fixed costs, that\'s all I\'ll say.' : `Economy feels ${phase} from where I stand. Foot traffic past my door looks about the same as yours.`,
      s.reputation > 65 ? 'My members talk about your place after spin class. That\'s free advertising.' : 'Want a tip? Get out on the street and shake hands. The market square on the weekend is where this block talks.',
    ],
    regular: [
      s.reputation > 70 ? 'Best spot on the block, dear. I tell everyone at bridge club.' : s.reputation < 40 ? 'I\'ll keep coming, dear. But people are talking, and not kindly. Fix it.' : 'Still settling in, aren\'t you? You\'ll find your feet.',
      s.fatigue > 55 ? 'Same things on offer every time I come in. Surprise me, would you?' : 'Bench is lovely this time of day. Come sit when you need to think.',
    ],
    banker: [
      s.loan ? `You owe us ${ui.money(s.loan)} at ${s.interestRate.toFixed(1)}%. Rates are drifting toward the economy, which is ${phase}.` : `Your account is clean. If you need a line of credit, the door's open. Current rate is ${s.interestRate.toFixed(1)}%.`,
      'Walk into the branch any time to borrow or pay down. It takes a little groundwork on your end.',
    ],
    accountant: [
      s.history.length ? `Last month you ${s.history[s.history.length - 1].profit >= 0 ? 'made' : 'lost'} ${ui.money(Math.abs(s.history[s.history.length - 1].profit))}. The full breakdown is in the books.` : 'First month. I\'ll keep the receipts straight, you keep the customers happy.',
    ],
  };
  chat(npc.p, c.name, c.role, c.look.clothes, lines[npc.id] ?? ['Busy day. Talk later.']);
}

// ---------------- interactions ----------------
interface Inter { key: string; x: number; z: number; r: number; label: string; sub?: string; enabled: boolean; run: () => void; person?: Person; mesh?: THREE.Object3D; priority?: number }

function interFor(npc: CastNpc): Inter {
  const c = CAST[npc.id as Exclude<CharacterId, 'narrator'>];
  const p = npc.p;
  const card = npc.cards.length ? state!.currentCards[npc.cards[0]] : undefined;
  if (card) {
    return { key: `cast:${npc.id}`, x: p.x, z: p.z, r: 1.7, label: `Talk to ${c.name}`, sub: card.title, enabled: true, run: () => playCard(npc), person: p, priority: 2 };
  }
  if (npc.id === 'accountant') {
    const left = state!.currentCards.length - state!.completedCards.length;
    return { key: 'cast:accountant', x: p.x, z: p.z, r: 1.7, label: 'Close the month with Priya', sub: left ? `${left} still waiting` : 'Everything is handled', enabled: true, run: () => closeMonthDialog(npc), person: p, priority: 2 };
  }
  return { key: `cast:${npc.id}`, x: p.x, z: p.z, r: 1.6, label: `Chat with ${c.name}`, sub: c.role, enabled: true, run: () => residentChat(npc), person: p };
}

function activityInter(id: string, anchor: string, key = id): Inter | null {
  const a = world!.anchors[anchor];
  if (!a || !state) return null;
  const act = ACTIVITIES.find((x) => x.id === id)!;
  const ok = canDoActivity(state, id);
  return {
    key, x: a.x, z: a.z, r: a.r, mesh: a.mesh,
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
  for (const npc of cast.values()) if (!npc.leaving) out.push(interFor(npc));
  for (const s of staff) out.push({ key: `staff:${s.name}`, x: s.p.x, z: s.p.z, r: 1.4, label: `Chat with ${s.name.split(' ')[0]}`, sub: 'your staff', enabled: true, person: s.p, run: () => chat(s.p, s.name, 'on your team', s.p.look.clothes, [s.line()]) });
  const acts: [string, string][] = [['serve', 'register'], ['clean', 'sink'], ['help', 'prep'], ['books', 'desk'], ['scout', 'rival'], ['network', 'market']];
  for (const [id, anchor] of acts) { const it = activityInter(id, anchor); if (it) out.push(it); }
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
  if (!player || ui.dialogOpen || ui.panelOpen || busy || mode !== 'play') { el.hidden = true; nearest = null; return; }
  let best: Inter | null = null;
  let bestScore = Infinity;
  for (const it of interactions()) {
    const d = Math.hypot(player.x - it.x, player.z - it.z);
    if (d > it.r) continue;
    const score = d - (it.priority ?? 0) * 0.6;
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
  player.walkTo(path(player.root.position, { x: it.x, z: it.z }));
}

// ---------------- input ----------------
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (mode === 'play' && !ui.dialogOpen) {
    if (k === 'escape' && ui.panelOpen) { e.preventDefault(); ui.closePanel(); return; }
    if (ui.panelOpen) return;
    if ((k === 'e' || k === 'enter' || k === ' ') && nearest) { e.preventDefault(); nearest.run(); return; }
    if (k === 'b') { openBooks(); return; }
  }
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
let dragged = false;
let pinch0 = 0;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  dragged = false;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch0) cam.dist = clampDist(cam.dist * (pinch0 / d));
    pinch0 = d;
    dragged = true;
    return;
  }
  if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 7) dragged = true;
  if (dragged && mode === 'play') {
    cam.yaw -= dx * 0.0065;
    cam.pitch = Math.max(0.32, Math.min(1.35, cam.pitch + dy * 0.004));
  }
});
canvas.addEventListener('pointerup', (e) => {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch0 = 0;
  if (!p || dragged || mode !== 'play' || e.button > 0) return;
  click(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = clampDist(cam.dist * (1 + Math.sign(e.deltaY) * 0.1)); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
const clampDist = (d: number) => Math.max(5, Math.min(30, d));

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function click(cx: number, cy: number) {
  if (!world || !player || ui.dialogOpen || ui.panelOpen || busy) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(world.clickables.filter((o) => o.visible !== false), true);
  const all = interactions();
  for (const h of hits.slice(0, 3)) {
    let o: THREE.Object3D | null = h.object;
    while (o) {
      const person = o.userData.person as Person | undefined;
      const it = all.find((i) => (person && i.person === person) || (!person && i.mesh === o));
      if (it) { goTo(it); return; }
      if (person) break;
      o = o.parent;
    }
  }
  // otherwise walk to the ground point
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pt = new THREE.Vector3();
  if (ray.ray.intersectPlane(plane, pt)) {
    pending = null;
    const x = Math.max(BOUNDS.x0 + 0.5, Math.min(BOUNDS.x1 - 0.5, pt.x));
    const z = Math.max(BOUNDS.z0 + 0.5, Math.min(BOUNDS.z1 - 0.5, pt.z));
    player.walkTo(path(player.root.position, { x, z }));
    marker(x, z);
  }
}

let markerMesh: THREE.Mesh | null = null;
let markerT = 0;
function marker(x: number, z: number) {
  if (!world) return;
  if (!markerMesh) {
    markerMesh = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
  }
  world.scene.add(markerMesh);
  markerMesh.position.set(x, groundY(x, z) + 0.03, z);
  markerT = 0.8;
}

$('prompt').addEventListener('click', () => nearest?.run());
$('btnBooks').addEventListener('click', () => openBooks());
$('btnTitle').addEventListener('click', () => {
  if (mode !== 'play' || ui.dialogOpen || closing) return;
  save();
  ui.closePanel();
  state = null;
  showSetup();
});
$('btnHelp').addEventListener('click', () => {
  const h = $('help');
  h.hidden = !h.hidden;
  $('btnHelp').setAttribute('aria-expanded', String(!h.hidden));
});
$('tasksToggle').addEventListener('click', () => {
  const t = $('tasks');
  t.classList.toggle('min');
  const min = t.classList.contains('min');
  $('tasksToggle').textContent = min ? 'Show' : 'Hide';
  $('tasksToggle').setAttribute('aria-expanded', String(!min));
});
function openBooks() { if (state && mode === 'play' && !ui.dialogOpen) ui.openPanel(`The books · ${monthName(state.month + 1)}`, ui.booksHtml(state)); }

// ---------------- name tags ----------------
const tags = new Map<number, HTMLDivElement>();
const v3 = new THREE.Vector3();
function updateTags() {
  if (!world || mode === 'setup') { for (const t of tags.values()) t.hidden = true; return; }
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
    v3.set(p.x, p.root.position.y + (p.sitting ? 1.75 : 2.2), p.z).project(camera);
    const vis = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
    el.hidden = !vis || ui.dialogOpen;
    if (vis) el.style.transform = `translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h}px) translate(-50%, -100%)`;
    el.style.left = '0'; el.style.top = '0';
  };
  if (state && player && mode === 'play') {
    for (const npc of cast.values()) {
      const c = CAST[npc.id as Exclude<CharacterId, 'narrator'>];
      const it = interFor(npc);
      if (npc.cards.length && state.currentCards[npc.cards[0]]) show(npc.p, `<span class="bang">!</span>${c.name}`, '', () => goTo(it));
      else if (npc.id === 'accountant') show(npc.p, `${state.completedCards.length >= state.currentCards.length ? '<span class="bang" style="background:var(--accent)">$</span>' : ''}Priya`, state.completedCards.length >= state.currentCards.length ? '' : 'quiet', () => goTo(it));
      else if (!npc.leaving && Math.hypot(npc.p.x - player.x, npc.p.z - player.z) < 9) show(npc.p, c.name, 'quiet', () => goTo(it));
    }
    for (const s of staff) if (Math.hypot(s.p.x - player.x, s.p.z - player.z) < 5) show(s.p, s.name.split(' ')[0], 'quiet', () => goTo(interactions().find((i) => i.person === s.p)!));
  }
  for (const [id, el] of tags) if (!seen.has(id)) el.hidden = true;
}

// ---------------- main loop ----------------
const clock = new THREE.Clock();
const MAX_DT = (window as unknown as { __maxDt?: number }).__maxDt ?? 0.05;
const fwd = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(MAX_DT, clock.getDelta());
  if (!world) return;
  const w = world;

  // player control
  if (player && mode === 'play') {
    let mx = 0, mz = 0;
    if (!ui.dialogOpen && !ui.panelOpen && !busy) {
      if (keys.has('w') || keys.has('arrowup')) mz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) mz += 1;
      if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
      if (keys.has('d') || keys.has('arrowright')) mx += 1;
    }
    if (mx || mz) {
      pending = null;
      player.stop();
      const len = Math.hypot(mx, mz);
      const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
      // camera-relative: forward is away from the camera
      const dx = (mx * cy + mz * sy) / len, dz = (-mx * sy + mz * cy) / len;
      const p = { x: player.x + dx * 3.6 * dt, z: player.z + dz * 3.6 * dt };
      collide(p, 0.3, w.colliders);
      for (const o of people) {
        if (o === player) continue;
        const ox = p.x - o.x, oz = p.z - o.z, d = Math.hypot(ox, oz);
        if (d < 0.55 && d > 1e-4) { p.x = o.x + (ox / d) * 0.55; p.z = o.z + (oz / d) * 0.55; }
      }
      const moved = Math.hypot(p.x - player.x, p.z - player.z);
      player.face(p.x, p.z);
      player.root.position.x = p.x;
      player.root.position.z = p.z;
      player.animate(dt, moved / dt, groundY);
    } else {
      player.speed = 3.4;
      player.update(dt, groundY, w.colliders);
    }
    if (pending?.person) {
      // chase a moving person: refresh the target and the route now and then
      const tp = pending.person;
      pending.x = tp.x; pending.z = tp.z;
      repathT -= dt;
      if (repathT <= 0 && Math.hypot(player.x - tp.x, player.z - tp.z) > pending.r * 0.85) {
        repathT = 0.6;
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
      if (busy.face) player.face(busy.face.x, busy.face.z);
      player.work();
      busy.t -= dt;
      if (busy.t <= 0) { const b = busy; busy = null; player.quiet(); b.done(); }
    }
  }
  for (const p of people) if (p !== player) p.update(dt, groundY);
  if (talking) talking.talk(dt);
  if (state && mode === 'play') { updateCustomers(dt); }
  else if (mode === 'setup') { updateSetupAmbient(dt); }
  updateCars(dt);

  // time of day follows the month's progress
  if (state && mode === 'play') {
    const want = closing ? 1 : 0.05 + progress() * 0.78;
    tod += (want - tod) * Math.min(1, dt * 0.6);
    w.setTime(tod);
  }

  // camera
  if (mode === 'play' && player) {
    const inside = insideShop(player.x, player.z);
    if (!inside) cam.yaw = Math.max(-1.4, Math.min(1.4, cam.yaw));
    const goal = cam.focus ?? new THREE.Vector3(player.x, 1.0, player.z);
    cam.target.lerp(goal, Math.min(1, dt * (cam.focus ? 3 : 6)));
  } else if (cam.orbit) {
    cam.yaw = 0.35 + Math.sin(performance.now() * 0.00008) * 0.55;
  }
  const dist = cam.focus ? Math.min(cam.dist, cam.focusDist) : cam.dist;
  const pitch = cam.focus ? Math.min(cam.pitch, 0.55) : cam.pitch;
  curDist += (dist - curDist) * Math.min(1, dt * 4);
  curPitch += (pitch - curPitch) * Math.min(1, dt * 4);
  fwd.set(Math.sin(cam.yaw) * Math.cos(curPitch), Math.sin(curPitch), Math.cos(cam.yaw) * Math.cos(curPitch));
  camera.position.copy(cam.target).addScaledVector(fwd, curDist);
  camera.lookAt(cam.target);

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
  renderer.render(w.scene, camera);
}
let curDist = 15;
let curPitch = 0.8;

// ---------------- setup screen ----------------
const sel = { business: 'coffee', location: 'average', preset: 0, name: '' } as { business: GameState['business']; location: GameState['location']; preset: number; name: string };
try { Object.assign(sel, JSON.parse(store.get(PREF_KEY) ?? '{}')); } catch { /* ignore */ }
if (!BUSINESSES.some((b) => b.id === sel.business)) sel.business = 'coffee';
if (!LOCATIONS.some((l) => l.id === sel.location)) sel.location = 'average';

function updateSetupAmbient(dt: number) {
  pedT -= dt;
  if (pedT <= 0) { pedT = 1.5 + Math.random() * 2; if (peds.length < 7) spawnPed(); }
  const done = peds.filter((q) => !q.p.path.length);
  for (const q of done) removePerson(q.p);
  peds = peds.filter((q) => q.p.path.length);
}

function showSetup() {
  mode = 'setup';
  closing = false;
  busy = null;
  pending = null;
  cam.focus = null;
  cam.orbit = true;
  cam.pitch = 0.42;
  cam.dist = 17;
  cam.target.set(0, 2.2, 1);
  $('hud').hidden = true;
  $('tasks').hidden = true;
  $('help').hidden = true;
  $('prompt').hidden = true;
  $('slate').hidden = true;
  rebuildPreview();
  renderSetup();
}

function rebuildPreview() {
  buildWorld(sel.business, sel.location, sel.name || OWNER_PRESETS[sel.preset].name);
  player = null;
  // the owner stands in the doorway
  const look = avatarLook({ skin: sel.preset, hair: 0, hairColor: 0 });
  const p = addPerson(new Person(look));
  p.place(0.6, 2.4, 0.2);
  player = null;
  world!.setTime(0.3);
  world!.setSeason(3);
}

function renderSetup() {
  const el = $('setup');
  el.innerHTML = ui.setupHtml(sel, !!loadSave());
  el.hidden = false;
  const rerender = (rebuild: boolean) => {
    store.set(PREF_KEY, JSON.stringify(sel));
    if (rebuild) rebuildPreview();
    renderSetup();
  };
  el.querySelectorAll<HTMLButtonElement>('[data-biz]').forEach((b) => b.addEventListener('click', () => { sel.business = b.dataset.biz as typeof sel.business; rerender(true); }));
  el.querySelectorAll<HTMLButtonElement>('[data-loc]').forEach((b) => b.addEventListener('click', () => { sel.location = b.dataset.loc as typeof sel.location; rerender(true); }));
  el.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => b.addEventListener('click', () => { sel.preset = Number(b.dataset.preset); rerender(true); }));
  const nameIn = $<HTMLInputElement>('ownerName');
  nameIn.addEventListener('change', () => { sel.name = nameIn.value.trim(); rerender(true); });
  $('startRun').addEventListener('click', () => {
    sel.name = nameIn.value.trim();
    store.set(PREF_KEY, JSON.stringify(sel));
    const name = sel.name || OWNER_PRESETS[sel.preset].name;
    beginPlay(newGame(sel.business, sel.location, name, { skin: sel.preset, hair: 0, hairColor: 0 }), true);
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
    buildWorld(s.business, s.location, s.ownerName);
    mode = 'play';
    cam.orbit = false;
    cam.pitch = 0.74;
    cam.dist = 17;
    cam.yaw = 0.25;
    player = addPerson(new Person(avatarLook(s.avatar)));
    player.speed = 3.4;
    player.place(0, 2.7, Math.PI);
    cam.target.set(0, 1, 2.7);
    curDist = cam.dist; curPitch = cam.pitch;
    $('hud').hidden = false;
    $('tasks').hidden = false;
    startMonth(true);
    if (fresh) setTimeout(() => { $('help').hidden = false; $('btnHelp').setAttribute('aria-expanded', 'true'); setTimeout(() => ($('help').hidden = true), 12000); }, 400);
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
  try {
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
  } catch { /* fonts are optional */ }
  $('loading').hidden = true;
  frame();
  const hot = data as { state?: GameState } | null;
  if (hot?.state && !hot.state.gameOver) beginPlay(hot.state, false);
  else showSetup();
}

window.claude?.hot?.snapshot?.(() => ({ state: mode === 'play' ? state : null }));
if ((window as unknown as { __maxDt?: number }).__maxDt) {
  (window as unknown as Record<string, unknown>).__bizsim = { player: () => player, state: () => state, world: () => world, cam };
}
const hot = window.claude?.hot;
if (hot?.ready) hot.ready((d) => boot(d)); else boot(hot?.data ?? null);
