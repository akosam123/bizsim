import { GameState } from './types';

/**
 * A barbershop is not a wage business — it's a landlord business.
 *
 * Barbers rent a chair from you by the month and keep what they cut. Your
 * income is the rent, which is only as steady as the people paying it. New
 * barbers are flaky: they arrive with no book, get bored or chase a better
 * room, and vanish inside a couple of months. The ones who stay long enough
 * to build a client list stop leaving, because leaving now costs them
 * something. That's the whole game — convert churn into tenure.
 *
 * Walk-ins belong to the shop, not to any barber: they go to whoever is
 * free, and a share of them come back for that barber specifically, which
 * grows that barber's book and glues them to your chair.
 */

export interface Barber {
  id: string;
  name: string;
  skill: number;          // 1-5: quality of cut, drives walk-in conversion
  clientele: number;      // their own regulars — the anchor that keeps them
  monthsHeld: number;     // tenure in your shop
  reliability: number;    // 0-100 — how likely to keep paying and show up
  rentOwed: number;       // this month's chair rent
}

/** A barber asking to rent a chair. */
export interface ChairApplicant extends Barber {
  pitch: string;
}

const FIRST = ['Dre', 'Kwame', 'Tone', 'Reggie', 'Sol', 'Nas', 'Papi', 'Rico',
  'Trey', 'Ced', 'Boogie', 'Marv', 'Jules', 'Sef', 'Ova', 'Quan'];

let seq = 0;
const uid = () => `bb-${Date.now().toString(36)}-${seq++}`;

function makeBarber(partial: Partial<Barber> = {}): Barber {
  const skill = partial.skill ?? 1 + Math.floor(Math.random() * 4);
  return {
    id: uid(),
    name: FIRST[Math.floor(Math.random() * FIRST.length)],
    skill,
    clientele: partial.clientele ?? Math.floor(Math.random() * 12),
    monthsHeld: 0,
    // reliability skews low: most people who want a chair are between things
    reliability: partial.reliability ?? 30 + Math.floor(Math.random() * 50),
    rentOwed: 0,
    ...partial,
  };
}

/** Somebody knocks: barbers find shops, not the other way round. */
export function rollApplicants(s: GameState, count = 1): ChairApplicant[] {
  const out: ChairApplicant[] = [];
  for (let i = 0; i < count; i++) {
    const b = makeBarber();
    const pitches = [
      `${b.clientele} heads that follow me. I just need a chair.`,
      'Between shops right now. Can start Monday.',
      'My old spot raised rent. I cut clean, ask anybody.',
      'Building my book. Give me a mirror and I\'ll fill it.',
      'I keep my station spotless and I pay on the first.',
    ];
    out.push({ ...b, pitch: pitches[Math.floor(Math.random() * pitches.length)] });
  }
  return out;
}

/** Chair rent scales with the room: nicer shop, better corner, higher rent. */
export function chairRent(s: GameState): number {
  const base = 420;
  const tier = 1 + (s.storeTier - 1) * 0.25;
  const condition = 0.85 + (s.condition / 100) * 0.3;
  const rep = 0.85 + (s.reputation / 100) * 0.35;
  return Math.round(base * tier * condition * rep * s.macro.cpi);
}

export function occupiedChairs(s: GameState): number {
  return s.barbers.length;
}

export function emptyChairs(s: GameState): number {
  return Math.max(0, s.chairs - s.barbers.length);
}

export function takeChair(s: GameState, applicant: ChairApplicant): GameState {
  if (emptyChairs(s) <= 0) return s;
  const { pitch, ...barber } = applicant;
  return {
    ...s,
    barbers: [...s.barbers, barber],
    log: [...s.log, `💈 ${barber.name} took a chair (${barber.clientele} regulars of their own).`],
  };
}

export function releaseChair(s: GameState, id: string): GameState {
  const b = s.barbers.find((x) => x.id === id);
  if (!b) return s;
  return {
    ...s,
    barbers: s.barbers.filter((x) => x.id !== id),
    log: [...s.log, `💈 You ended ${b.name}'s chair agreement.`],
  };
}

/** Chance a barber walks this month. Brand new = very flaky; a barber with a
 * real book has too much to lose, and a well-kept shop holds people. */
export function churnChance(b: Barber, s: GameState): number {
  const green = Math.max(0, 3 - b.monthsHeld) * 0.11;      // first months are the risky ones
  const rootedness = Math.min(0.28, b.clientele * 0.006);  // their book anchors them
  const unreliable = (100 - b.reliability) / 100 * 0.14;
  const shabby = s.condition < 45 ? 0.09 : 0;
  const quiet = s.reputation < 40 ? 0.06 : 0;
  return Math.max(0.02, green + unreliable + shabby + quiet - rootedness);
}

export interface BarberMonth {
  rentCollected: number;
  unpaid: number;
  ownerCuts: number;       // revenue from the owner's own chair
  walkInsServed: number;
  left: string[];
  newRegulars: number;
}

/**
 * Settle a month of the booth-rental business. Called by the engine instead
 * of the wage/margin model when the player runs a barbershop.
 */
export function settleBarberMonth(s: GameState, walkInsPerMonth: number): {
  barbers: Barber[]; result: BarberMonth; log: string[];
} {
  const log: string[] = [];
  const rent = chairRent(s);
  const working = s.ownerChair ? s.barbers.length + 1 : s.barbers.length;
  const result: BarberMonth = {
    rentCollected: 0, unpaid: 0, ownerCuts: 0, walkInsServed: 0, left: [], newRegulars: 0,
  };

  // walk-ins are the shop's, split across whoever has a free chair
  const capacityPerBarber = 170;
  const servable = Math.min(walkInsPerMonth, working * capacityPerBarber);
  result.walkInsServed = Math.round(servable);
  const perBarber = working > 0 ? servable / working : 0;

  let barbers = s.barbers.map((b) => ({ ...b }));

  // rent day
  for (const b of barbers) {
    const pays = Math.random() * 100 < b.reliability + 25;
    if (pays) {
      result.rentCollected += rent;
      b.rentOwed = 0;
      b.reliability = Math.min(100, b.reliability + 2);
    } else {
      result.unpaid += rent;
      b.rentOwed += rent;
      b.reliability = Math.max(0, b.reliability - 8);
      log.push(`💸 ${b.name} came up short on chair rent this month.`);
    }
  }

  // walk-ins convert into a barber's own regulars — this is what roots them
  for (const b of barbers) {
    const converted = perBarber * (0.05 + b.skill * 0.02) * (s.reputation / 100);
    b.clientele = Math.round(b.clientele + converted);
    result.newRegulars += Math.round(converted);
    b.monthsHeld += 1;
  }

  // the owner's own chair: you keep every cut you make yourself
  if (s.ownerChair) {
    const ticket = 23 * s.macro.cpi;
    result.ownerCuts = Math.round(perBarber * ticket);
  }

  // who walks
  const staying: Barber[] = [];
  for (const b of barbers) {
    if (Math.random() < churnChance(b, s)) {
      result.left.push(b.name);
      log.push(b.monthsHeld <= 2
        ? `🚪 ${b.name} cleared out their station after ${b.monthsHeld} month${b.monthsHeld === 1 ? '' : 's'}. Barely warmed the seat.`
        : `🚪 ${b.name} left after ${b.monthsHeld} months and took ${b.clientele} regulars with them.`);
    } else {
      staying.push(b);
    }
  }

  if (result.rentCollected > 0) {
    log.push(`💈 Chair rent collected: $${result.rentCollected.toLocaleString()} from ${barbers.length - result.left.length + result.left.length} chair${barbers.length === 1 ? '' : 's'}.`);
  }
  const empty = Math.max(0, s.chairs - staying.length);
  if (empty > 0) log.push(`🪑 ${empty} chair${empty === 1 ? '' : 's'} sitting empty — that's $${(empty * rent).toLocaleString()} you didn't earn.`);

  return { barbers: staying, result, log };
}
