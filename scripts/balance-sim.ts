/**
 * Headless balance harness for the story-card era. Three player archetypes
 * play every business × location combo by actually drawing and answering
 * scenario cards, exactly like the app does.
 *
 *   npx tsx scripts/balance-sim.ts
 */
import { BUSINESSES, LOCATIONS, businessOf } from '../src/game/config';
import { applyOption, drawCards } from '../src/game/decisions';
import { endMonth, newGame, scoreGame } from '../src/game/engine';
import { DecisionCard, GameState } from '../src/game/types';

type Chooser = (s: GameState, card: DecisionCard) => number;

const byTone = (s: GameState, card: DecisionCard, order: string[]): number => {
  for (const t of order) {
    const i = card.options.findIndex((o) => o.tone === t);
    if (i >= 0) return i;
  }
  return 0;
};

/** The miser: always the cheapest/ignore option. Choices should have consequences. */
const miser: Chooser = (s, card) => byTone(s, card, ['thrifty', 'steady', 'bold']);

/** The plodder: takes the sensible middle path every time. */
const plodder: Chooser = (s, card) => byTone(s, card, ['steady', 'thrifty', 'bold']);

/** The operator: reads the situation card by card. */
const operator: Chooser = (s, card) => {
  const last = s.history[s.history.length - 1];
  const flush = s.cash > 15000;
  const idxOf = (pred: (label: string) => boolean) => card.options.findIndex((o) => pred(o.label));
  switch (card.id) {
    case 'price-review': {
      if (s.reputation >= 68 && s.priceLevel !== 'luxury') return idxOf((l) => l.startsWith('Raise'));
      if (s.reputation < 40 && s.priceLevel !== 'budget') return idxOf((l) => l.startsWith('Cut'));
      return idxOf((l) => l.startsWith('Hold'));
    }
    case 'marketing-review': {
      const capacityBound = last && last.lostToCapacity > last.customers * 0.08;
      if (capacityBound) return idxOf((l) => l.startsWith('Go dark'));
      if (s.cash > 35000) return idxOf((l) => l.startsWith('Big'));
      if (s.cash > 10000) return idxOf((l) => l.startsWith('Local'));
      return idxOf((l) => l.startsWith('Go dark'));
    }
    case 'renovation-offer': {
      const crowded = last && last.lostToCapacity > last.customers * 0.08;
      return crowded && s.cash > businessOf(s.business).renovationCost * 1.3 ? 0 : 1;
    }
    case 'product-launch':
      return s.fatigue > 40 && flush ? 0 : 1;
    case 'bank-visit': {
      const crowded = last && last.lostToCapacity > last.customers * 0.12;
      if (crowded && s.cash < 12000) return Math.max(0, idxOf((l) => l.startsWith('Borrow')));
      if (s.loan > 0 && s.cash > s.loan + 15000) return Math.max(0, idxOf((l) => l.startsWith('Repay')));
      return card.options.length - 1;
    }
    case 'staffing-review': {
      const biz = businessOf(s.business);
      const needed = last ? Math.ceil(last.customers / 30 / biz.custPerStaffPerDay) : s.staff;
      if (s.staff < needed && flush) return Math.max(0, idxOf((l) => l.startsWith('Hire')));
      if (s.staff > needed + 1) return Math.max(0, idxOf((l) => l.startsWith('Trim')));
      return Math.max(0, idxOf((l) => l.includes('bonus')));
    }
    case 'flash-promo': {
      const capacityBound = last && last.lostToCapacity > last.customers * 0.08;
      return !capacityBound && s.cash > 4000 ? 0 : card.options.length - 1;
    }
    case 'partnership':
      return flush ? 0 : 1;
    case 'supplier-squeeze':
      return byTone(s, card, ['steady']);
    case 'poach-attempt':
      return 0;
    default:
      // event cards + ops dilemmas: invest when solvent, endure when broke
      return s.cash > 6000 ? byTone(s, card, ['steady', 'bold', 'thrifty']) : byTone(s, card, ['thrifty', 'steady', 'bold']);
  }
};

function runOne(business: string, location: string, choose: Chooser) {
  let s = newGame(business as any, location as any, 'Sim');
  while (!s.gameOver) {
    const cards = drawCards(s);
    s = { ...s, currentCards: cards };
    for (const card of cards) {
      if (s.gameOver) break;
      const idx = Math.max(0, choose(s, card));
      s = applyOption(s, card, idx);
    }
    s = endMonth(s).state;
  }
  const score = scoreGame(s);
  return { bankrupt: s.bankrupt, valuation: score.valuation, grade: score.grade };
}

const TRIALS = 120;
const policies: [string, Chooser][] = [['miser', miser], ['plodder', plodder], ['operator', operator]];

for (const [policyName, choose] of policies) {
  console.log(`\n=== policy: ${policyName} ===`);
  console.log('combo'.padEnd(26), 'bankrupt', 'medianVal'.padStart(10), '  grades');
  for (const b of BUSINESSES) {
    for (const l of LOCATIONS) {
      const results = Array.from({ length: TRIALS }, () => runOne(b.id, l.id, choose));
      const bankruptPct = Math.round((results.filter((r) => r.bankrupt).length / TRIALS) * 100);
      const vals = results.map((r) => r.valuation).sort((a, z) => a - z);
      const median = vals[Math.floor(vals.length / 2)];
      const grades = ['S', 'A', 'B', 'C', 'D'].map(
        (g) => `${g}:${Math.round((results.filter((r) => r.grade === g).length / TRIALS) * 100)}%`,
      ).join(' ');
      console.log(`${b.id}/${l.id}`.padEnd(26), `${bankruptPct}%`.padStart(7), `$${median.toLocaleString()}`.padStart(11), ` ${grades}`);
    }
  }
}
