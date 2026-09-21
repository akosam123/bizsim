import {
  ACTIVITY_ENERGY_COST, AP_CAP, BURNOUT_THRESHOLD, MANAGER_HIRE_COST,
  NEW_BUSINESS_COST, VENTURE_AP, VENTURE_COST, businessOf,
} from './config';
import { BusinessId, GameState, StaffMember, Venture, WorldRoom } from './types';

/**
 * The ops layer: what the owner does with their own two hands.
 *
 * Pitching in earns action points (AP). AP buys the off-schedule moves —
 * a bank loan, an ad campaign, eventually a second location. Every activity
 * drains the owner's energy, and the only way to really refill it is a
 * proper break — which the business survives only if a manager is running it.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---- the roster ----

const FIRST_NAMES = [
  'Maya', 'Jordan', 'Chris', 'Aisha', 'Leo', 'Nina', 'Omar', 'Tasha',
  'Felix', 'Rosa', 'Devon', 'Kim', 'Ivan', 'Gloria', 'Pete', 'Simone',
];

let staffSeq = 0;

export function genStaff(role: 'staff' | 'manager' = 'staff', monthsEmployed = 0): StaffMember {
  staffSeq += 1;
  const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  return {
    id: `st-${Date.now().toString(36)}-${staffSeq}`,
    name,
    skill: role === 'manager' ? 4 : 1 + Math.floor(Math.random() * 2),
    hustle: 35 + Math.floor(Math.random() * 60),
    morale: 60 + Math.floor(Math.random() * 20),
    monthsEmployed,
    role,
  };
}

export function buildRoster(count: number, monthsEmployed = 0): StaffMember[] {
  return Array.from({ length: Math.max(1, count) }, () => genStaff('staff', monthsEmployed));
}

export function managerOf(s: GameState): StaffMember | null {
  return s.roster.find((m) => m.role === 'manager') ?? null;
}

/** Keep the roster and the `staff` headcount in sync — scenario cards still
 * hire/fire by number, so the roster follows: new faces walk in, and cuts
 * fall on whoever's checked out. The manager is never auto-cut. */
export function reconcileRoster(s: GameState): StaffMember[] {
  const roster = s.roster.map((m) => ({ ...m }));
  while (roster.length < s.staff) roster.push(genStaff());
  while (roster.length > s.staff && roster.length > 1) {
    const cuttable = roster.filter((m) => m.role !== 'manager');
    if (!cuttable.length) break;
    const lowest = cuttable.reduce((a, b) => (a.morale <= b.morale ? a : b));
    roster.splice(roster.findIndex((m) => m.id === lowest.id), 1);
  }
  return roster;
}

// ---- activities: earn AP with your own hands ----

export interface Activity {
  id: string;
  venue: WorldRoom;
  label: (business: BusinessId) => string;
  hint: string;
}

export const ACTIVITIES: Activity[] = [
  {
    id: 'serve', venue: 'inside',
    // what "working the floor" actually means depends on the trade: you take
    // a chair in a barbershop and work the till in a shop, you don't serve a
    // line in either
    label: (b) => ({
      restaurant: 'Wait the tables',
      coffee: 'Serve the line',
      bakery: 'Serve the counter',
      convenience: 'Work the till',
      barber: 'Take the next chair',
    }[b] ?? 'Work the floor'),
    hint: '+1 AP · customers remember the owner showing up',
  },
  {
    id: 'clean', venue: 'back',
    label: () => 'Deep clean & maintain',
    hint: '+1 AP · keeps the place from wearing down',
  },
  {
    id: 'help', venue: 'back',
    label: (b) => (b === 'restaurant' || b === 'bakery' ? 'Help the kitchen' : 'Pitch in out back'),
    hint: '+1 AP · the team notices',
  },
  {
    id: 'books', venue: 'office',
    label: () => 'Work the books',
    hint: '+1 AP · find the quiet leaks',
  },
  {
    id: 'scout', venue: 'street',
    label: () => 'Scout the competition',
    hint: '+1 AP · walk main street, take notes',
  },
  {
    id: 'network', venue: 'street',
    label: () => 'Work the market crowd',
    hint: '+1 AP · faces remember faces',
  },
];

export function activitiesFor(venue: WorldRoom): Activity[] {
  return ACTIVITIES.filter((a) => a.venue === venue);
}

export function canDoActivity(s: GameState, id: string): { ok: boolean; why?: string } {
  if (s.activitiesDone.includes(id)) return { ok: false, why: 'Already done this month' };
  if (s.energy < ACTIVITY_ENERGY_COST + 3) return { ok: false, why: 'Too tired — you need a break' };
  return { ok: true };
}

/** Do an activity: costs energy, earns AP, and leaves a real mark on the month. */
export function doActivity(s: GameState, id: string): { state: GameState; line: string } {
  const check = canDoActivity(s, id);
  if (!check.ok) return { state: s, line: check.why! };
  const next: GameState = {
    ...s,
    roster: s.roster.map((m) => ({ ...m })),
    plan: { ...s.plan },
    log: [...s.log],
    energy: clamp(s.energy - ACTIVITY_ENERGY_COST, 0, 100),
    ap: Math.min(AP_CAP, s.ap + 1),
    activitiesDone: [...s.activitiesDone, id],
  };
  let line = '';
  if (id === 'serve') {
    next.plan.repDelta += 1;
    next.plan.loyaltyDelta += 3;
    line = '💪 You worked the front yourself. A few faces will be back because of it. (+1 AP)';
  } else if (id === 'clean') {
    next.condition = clamp(next.condition + 14, 0, 100);
    line = '🧽 You scrubbed, tightened, and oiled. The place runs like it did on day one. (+1 AP)';
  } else if (id === 'help') {
    next.roster = next.roster.map((m) => ({ ...m, morale: clamp(m.morale + 5, 0, 100) }));
    next.plan.moraleDelta += 4;
    line = '🤝 You rolled your sleeves up next to the team. They clocked it. (+1 AP)';
  } else if (id === 'books') {
    next.plan.cogsMult *= 0.985;
    line = '🧾 Two hours in the ledgers found waste nobody was watching. (+1 AP)';
  } else if (id === 'scout') {
    next.plan.demandMult *= 1.01;
    const rivals = s.competitors;
    line = rivals.length
      ? `🕵️ You walked past ${rivals[0].name} and price-checked everything. ${rivals.length > 1 ? `${rivals.length} rivals in play.` : 'Now you know their angle.'} (+1 AP)`
      : '🕵️ You walked main street end to end. Quiet out there — the market is yours for now. (+1 AP)';
  } else if (id === 'network') {
    next.plan.repDelta += 1;
    next.plan.loyaltyDelta += 2;
    line = '🤝 An hour at the market square shaking hands. A few of them will come by. (+1 AP)';
  }
  next.log.push(line);
  return { state: next, line };
}

// ---- the manager, promotions, and the owner's break ----

/** Long-tenured, hardworking staff who get passed over take it personally. */
function applyMissedPromotion(roster: StaffMember[], promotedId: string | null, log: string[]): StaffMember[] {
  return roster.map((m) => {
    if (m.id === promotedId || m.role === 'manager') return m;
    if (m.monthsEmployed >= 6 && m.hustle >= 70) {
      log.push(`😔 ${m.name} has given this place ${m.monthsEmployed} months and heard the news quietly.`);
      return { ...m, morale: clamp(m.morale - 16, 0, 100) };
    }
    return m;
  });
}

export function promoteToManager(s: GameState, staffId: string): GameState {
  if (managerOf(s)) return s;
  const member = s.roster.find((m) => m.id === staffId);
  if (!member) return s;
  const log = [...s.log, `📣 ${member.name} is your new manager. They earned it.`];
  let roster = s.roster.map((m) =>
    m.id === staffId
      ? { ...m, role: 'manager' as const, morale: clamp(m.morale + 20, 0, 100), skill: Math.min(5, m.skill + 1) }
      : { ...m });
  roster = applyMissedPromotion(roster, staffId, log);
  return { ...s, roster, log };
}

export function hireOutsideManager(s: GameState): GameState {
  if (managerOf(s)) return s;
  const cost = Math.round(MANAGER_HIRE_COST * s.macro.cpi);
  if (s.cash < cost) return s;
  const mgr = genStaff('manager');
  const log = [...s.log, `🤵 Hired ${mgr.name} to manage — a steady outside hand ($${cost.toLocaleString()}).`];
  let roster = [...s.roster.map((m) => ({ ...m })), mgr];
  roster = applyMissedPromotion(roster, null, log);
  return { ...s, cash: s.cash - cost, staff: s.staff + 1, roster, log };
}

export function canTakeBreak(s: GameState): { ok: boolean; why?: string } {
  if (!managerOf(s)) return { ok: false, why: 'You need a manager before you can step away' };
  if ((s.cooldowns['take-break'] ?? 0) > 0) return { ok: false, why: 'You just got back — give it a couple of months' };
  if (s.energy >= 85) return { ok: false, why: "You're fresh — save the getaway" };
  return { ok: true };
}

/** A real week off. The manager holds the fort — how well depends on them. */
export function takeBreak(s: GameState): GameState {
  const check = canTakeBreak(s);
  if (!check.ok) return s;
  const mgr = managerOf(s)!;
  const dip = Math.max(0, 0.05 - (mgr.skill - 3) * 0.02); // skill 3 → -5%, skill 5 → -1%
  return {
    ...s,
    energy: 100,
    cooldowns: { ...s.cooldowns, 'take-break': 3 },
    effects: [...s.effects, {
      id: 'owner-break', label: `${mgr.name} ran the shop while you rested`,
      monthsLeft: 1, demandMult: 1 - dip, cogsMult: 1, good: true,
    }],
    log: [...s.log, `🌴 You took a real week off. ${mgr.name} kept the lights on.`],
  };
}

// ---- ventures: a second location, or a whole new business ----

export function canOpenVenture(s: GameState, business: BusinessId): { ok: boolean; why?: string; cost: number } {
  const sameBiz = business === s.business;
  const cost = Math.round((sameBiz ? VENTURE_COST : NEW_BUSINESS_COST) * s.macro.cpi);
  if (!managerOf(s)) return { ok: false, why: 'Someone has to run it — promote or hire a manager first', cost };
  if (s.ap < VENTURE_AP) return { ok: false, why: `Takes ${VENTURE_AP} AP of groundwork — keep pitching in`, cost };
  if (s.cash < cost) return { ok: false, why: 'Not enough cash', cost };
  return { ok: true, cost };
}

/** Opening a venture SENDS YOUR MANAGER to run it — you're solo again. */
export function openVenture(s: GameState, business: BusinessId): GameState {
  const check = canOpenVenture(s, business);
  if (!check.ok) return s;
  const mgr = managerOf(s)!;
  const biz = businessOf(business);
  const name = business === s.business
    ? `${s.ownerName || 'Your'} ${biz.name} №2`
    : `${s.ownerName ? `${s.ownerName}'s` : 'The new'} ${biz.name}`;
  const venture: Venture = {
    id: `v-${Date.now().toString(36)}`,
    name,
    business,
    managerName: mgr.name,
    managerSkill: mgr.skill,
    openedMonth: s.month,
  };
  return {
    ...s,
    cash: s.cash - check.cost,
    ap: s.ap - VENTURE_AP,
    staff: Math.max(1, s.staff - 1),
    roster: s.roster.filter((m) => m.id !== mgr.id),
    ventures: [...s.ventures, venture],
    log: [...s.log, `🏗 ${name} is open — ${mgr.name} moved over to run it. You're back to running this floor yourself.`],
  };
}

/** A venture's monthly net: ramps up over its first quarter, rides the macro,
 * and leans hard on the manager you gave it. Recessions bite. */
export function ventureMonthly(v: Venture, s: GameState): number {
  const monthsOpen = s.month - v.openedMonth;
  if (monthsOpen <= 0) return 0;
  const ramp = Math.min(1, monthsOpen / 3);
  const base = (700 + v.managerSkill * 550) * s.macro.cpi;
  const swing = (s.macro.confidence - 0.95) * 5000;
  const noise = (Math.random() - 0.45) * 1400;
  return Math.round((base + swing + noise) * ramp);
}

export function isBurnedOut(s: GameState): boolean {
  return s.energy <= BURNOUT_THRESHOLD;
}
