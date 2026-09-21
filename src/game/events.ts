import { businessOf } from './config';
import { ActiveEffect, GameState, PendingChoice } from './types';

export interface EventResult {
  effect?: ActiveEffect;
  repDelta?: number;
  cashDelta?: number;
  rateDelta?: number;
  conditionDelta?: number;
  headline: string;
  good: boolean;
  /** if set, the player must decide before the next month */
  choice?: PendingChoice;
  armsInspection?: boolean;
}

interface EventDef {
  id: string;
  weight: (s: GameState) => number;
  roll: (s: GameState) => EventResult;
}

const EVENTS: EventDef[] = [
  {
    id: 'viral-review',
    weight: (s) => 1 + s.reputation / 50,
    roll: () => ({
      headline: '📈 A glowing review goes viral! Crowds pour in.',
      good: true,
      repDelta: 6,
      effect: { id: 'viral-review', label: 'Viral review', monthsLeft: 2, demandMult: 1.3, cogsMult: 1, good: true },
    }),
  },
  {
    id: 'festival',
    weight: () => 1,
    roll: () => ({
      headline: '🎉 A local festival brings the whole area out.',
      good: true,
      effect: { id: 'festival', label: 'Local festival', monthsLeft: 1, demandMult: 1.4, cogsMult: 1, good: true },
    }),
  },
  {
    id: 'celebrity',
    weight: (s) => 0.3 + s.reputation / 100,
    roll: () => ({
      headline: '🌟 A celebrity was spotted at your place. Everyone wants in!',
      good: true,
      repDelta: 10,
      effect: { id: 'celebrity', label: 'Celebrity buzz', monthsLeft: 1, demandMult: 1.5, cogsMult: 1, good: true },
    }),
  },
  {
    id: 'bad-press',
    weight: (s) => 1 + (100 - s.reputation) / 60,
    roll: () => ({
      headline: '📉 A scathing review is making the rounds online.',
      good: false,
      choice: {
        id: 'bad-press',
        headline: '📉 A scathing review is going viral',
        body: 'A prominent reviewer torched you online and it\'s spreading. How do you respond?',
        options: [
          { label: 'Public apology + staff retraining ($1,500)', hint: 'Costs money now, contains the damage' },
          { label: 'Ignore it', hint: 'Free, but the story runs its course' },
        ],
      },
    }),
  },
  {
    id: 'supply-spike',
    weight: (s) => (s.supplierDealMonths > 0 ? 0.3 : 1) * (s.macro.phase === 'boom' ? 1.5 : 1) * Math.min(1.2, businessOf(s.business).cogsRate * 2.5),
    roll: () => ({
      headline: '🚚 Supplier prices spike. Your cost of goods jumps.',
      good: false,
      effect: { id: 'supply-spike', label: 'Supply costs up', monthsLeft: 2, demandMult: 1, cogsMult: 1.2, good: false },
    }),
  },
  {
    id: 'supplier-deal',
    weight: (s) => (s.supplierDealMonths > 0 ? 0 : 0.9 * Math.min(1.2, businessOf(s.business).cogsRate * 2.5)),
    roll: () => ({
      headline: '🤝 A supplier is offering a contract.',
      good: true,
      choice: {
        id: 'supplier-deal',
        headline: '🤝 Supplier contract on the table',
        body: 'A regional supplier offers to lock in your goods cost 8% below market for 6 months. Signing costs a $1,000 onboarding fee.',
        options: [
          { label: 'Sign the contract ($1,000)', hint: '-8% cost of goods for 6 months, shields you from supply spikes' },
          { label: 'Stay flexible', hint: 'No fee, no protection' },
        ],
      },
    }),
  },
  {
    id: 'influencer',
    weight: (s) => 0.7 + (s.marketingTier !== 'none' ? 0.4 : 0),
    roll: () => ({
      headline: '📱 An influencer wants to feature you.',
      good: true,
      choice: {
        id: 'influencer',
        headline: '📱 Influencer collab offer',
        body: 'A popular local influencer will feature your business for $2,000. Expect a big rush — and a crowd that expects something new next time.',
        options: [
          { label: 'Pay $2,000 for the feature', hint: '+40% demand for a month, +8 customer fatigue after' },
          { label: 'Pass', hint: 'Keep the cash' },
        ],
      },
    }),
  },
  {
    id: 'inspection-notice',
    weight: (s) => (s.inspectionDue ? 0 : 0.8),
    roll: () => ({
      headline: '📋 Notice: a health & safety inspector will visit next month.',
      good: false,
      armsInspection: true,
    }),
  },
  {
    id: 'breakdown',
    // machines don't die out of nowhere — they die after months of hard use
    // with nobody maintaining them; a well-kept shop simply doesn't roll this
    weight: (s) => (s.month < 4 || s.condition >= 45 ? 0 : 0.5 + (45 - s.condition) / 22),
    roll: (s) => ({
      headline: '🔧 The equipment finally gave out — you knew it was coming. Emergency repairs hurt.',
      good: false,
      cashDelta: -Math.round((1500 + Math.random() * 2000) * s.macro.cpi),
      conditionDelta: 30, // the repair crew at least leaves things solid
    }),
  },
  {
    id: 'rate-hike',
    weight: (s) => (s.interestRate < 11 && (s.macro.phase === 'boom' || s.macro.phase === 'steady') ? 0.7 : 0.1),
    roll: () => ({
      headline: '🏦 The central bank hiked rates. Borrowing just got pricier.',
      good: false,
      rateDelta: 1,
    }),
  },
  {
    id: 'rate-cut',
    weight: (s) => (s.interestRate > 3 && (s.macro.phase === 'downturn' || s.macro.phase === 'recession') ? 1.2 : 0.15),
    roll: () => ({
      headline: '🏦 The central bank cut rates. Loans are cheaper now.',
      good: true,
      rateDelta: -1,
    }),
  },
];

/** ~45% chance one event fires in a given month. */
export function maybeRollEvent(s: GameState): EventResult | null {
  if (Math.random() > 0.45) return null;
  const weights = EVENTS.map((e) => e.weight(s));
  const active = new Set(s.effects.map((e) => e.id));
  EVENTS.forEach((e, i) => {
    if (active.has(e.id)) weights[i] = 0;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (let i = 0; i < EVENTS.length; i++) {
    r -= weights[i];
    if (r <= 0) return EVENTS[i].roll(s);
  }
  return null;
}

/** Applies the player's decision on a pending choice. Returns log lines. */
export function resolveChoice(s: GameState, optionIndex: number): { state: GameState; lines: string[] } {
  const c = s.pendingChoice;
  if (!c) return { state: s, lines: [] };
  const next = { ...s, effects: [...s.effects], pendingChoice: null as PendingChoice | null };
  const lines: string[] = [];

  if (c.id === 'bad-press') {
    if (optionIndex === 0) {
      next.cash -= 1500;
      next.reputation = Math.max(0, next.reputation - 3);
      next.effects.push({ id: 'bad-press', label: 'Bad press (contained)', monthsLeft: 1, demandMult: 0.88, cogsMult: 1, good: false });
      lines.push('🧯 You apologized publicly and retrained staff. The story fizzled early.');
    } else {
      next.reputation = Math.max(0, next.reputation - 8);
      next.effects.push({ id: 'bad-press', label: 'Bad press', monthsLeft: 2, demandMult: 0.75, cogsMult: 1, good: false });
      lines.push('🙈 You ignored the review. It kept circulating.');
    }
  } else if (c.id === 'supplier-deal') {
    if (optionIndex === 0) {
      next.cash -= 1000;
      next.supplierDealMonths = 6;
      lines.push('🤝 Supplier contract signed: goods cost locked 8% below market for 6 months.');
    } else {
      lines.push('You passed on the supplier contract.');
    }
  } else if (c.id === 'influencer') {
    if (optionIndex === 0) {
      next.cash -= 2000;
      next.effects.push({ id: 'influencer', label: 'Influencer feature', monthsLeft: 1, demandMult: 1.4, cogsMult: 1, good: true });
      next.fatigue = Math.min(100, next.fatigue + 8);
      lines.push('📱 The influencer post is live — brace for the rush.');
    } else {
      lines.push('You passed on the influencer collab.');
    }
  }

  next.log = [...next.log, ...lines];
  return { state: next, lines };
}
