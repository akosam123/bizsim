import { businessOf, locationOf, priceLevelOf } from './config';
import { Competitor, GameState } from './types';

/**
 * Rival businesses are real entities: they enter when your market looks
 * juicy, split contested demand with you by relative attractiveness, and
 * fold if you out-compete them long enough.
 */

const NAME_POOLS: Record<string, string[]> = {
  restaurant: ['Mama Rosa\'s', 'The Golden Spoon', 'Ember & Oak', 'Lucky Dragon'],
  convenience: ['QuickMart', 'Corner Depot', '24/7 Express', 'GrabNGo'],
  coffee: ['Bean Scene', 'Roast Republic', 'The Daily Grind', 'Brewtopia'],
  bakery: ['Flour Power', 'The Rolling Pin', 'Crumb & Crust', 'Sweet Rise'],
  barber: ['Fade Factory', 'The Sharp Edge', 'Clipper City', 'Uptown Cuts'],
};

const STANCES: Competitor['stance'][] = ['discount', 'quality', 'copycat'];

export const STANCE_DESC: Record<Competitor['stance'], string> = {
  discount: 'undercutting your prices',
  quality: 'competing on quality',
  copycat: 'copying your playbook',
};

/** Your attractiveness in the market: value-for-money × brand × freshness. */
export function playerAttractiveness(s: GameState): number {
  const priceMult = priceLevelOf(s.priceLevel).mult;
  const quality = 0.55 + (s.reputation / 100) * 0.6 + (s.storeTier - 1) * 0.12;
  const valueForMoney = quality / Math.pow(priceMult, 0.8);
  const freshness = 1 - (s.fatigue / 100) * 0.25;
  return valueForMoney * freshness;
}

export function competitorAttractiveness(c: Competitor): number {
  // a new entrant ramps up over ~6 months before hitting full strength,
  // with a small grand-opening buzz on top
  const rampUp = Math.min(1, 0.5 + c.monthsActive * 0.085);
  const openingBuzz = c.monthsActive <= 1 ? 1.15 : 1;
  return c.strength * rampUp * openingBuzz;
}

export interface CompetitorStep {
  competitors: Competitor[];
  headlines: string[];
  /** share of contested demand the player keeps, 0-1 */
  playerShare: number;
}

export function stepCompetitors(s: GameState, recentMargin: number): CompetitorStep {
  const loc = locationOf(s.location);
  const headlines: string[] = [];
  let competitors = s.competitors.map((c) => ({ ...c, monthsActive: c.monthsActive + 1 }));

  const you = playerAttractiveness(s);

  // --- exits: rivals fold when persistently outclassed ---
  competitors = competitors.filter((c) => {
    const them = competitorAttractiveness(c);
    const losing = them < you * 0.62;
    const exitChance = (losing ? 0.22 : 0.02) + Math.max(0, c.monthsActive - 14) * 0.02;
    if (Math.random() < exitChance) {
      headlines.push(`🎊 ${c.name} closed its doors. One less rival.`);
      return false;
    }
    return true;
  });

  // --- entries: healthy margins in a dense market attract sharks ---
  const maxRivals = s.location === 'high' ? 3 : s.location === 'average' ? 2 : 1;
  if (competitors.length < maxRivals) {
    const marginLure = Math.min(0.6, Math.max(0, recentMargin) * 2); // 30% margin → +0.6
    const boomLure = s.macro.phase === 'boom' ? 0.35 : s.macro.phase === 'recession' ? -0.5 : 0;
    const entryChance = loc.competitorPressure * 0.09 * (1 + marginLure + boomLure);
    if (Math.random() < entryChance) {
      const pool = NAME_POOLS[s.business];
      const used = new Set(competitors.map((c) => c.name));
      const available = pool.filter((n) => !used.has(n));
      if (available.length) {
        const stance = STANCES[Math.floor(Math.random() * STANCES.length)];
        const c: Competitor = {
          id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          name: available[Math.floor(Math.random() * available.length)],
          stance,
          strength: 0.45 + Math.random() * 0.4,
          monthsActive: 0,
        };
        competitors.push(c);
        headlines.push(`🏢 ${c.name} just opened nearby — ${STANCE_DESC[c.stance]}.`);
      }
    }
  }

  // --- market share: you vs. the field ---
  // even with no named rival, denser areas have diffuse alternatives
  // (chains, food courts, the place around the corner) that skim demand
  const diffusePull = loc.competitorPressure * 0.35;
  const rivalPull = diffusePull + competitors.reduce((a, c) => {
    let pull = competitorAttractiveness(c);
    // discounters bite hardest when you price high; quality rivals when your rep is low
    if (c.stance === 'discount') pull *= priceLevelOf(s.priceLevel).mult >= 1.15 ? 1.3 : 1.0;
    if (c.stance === 'quality') pull *= s.reputation < 50 ? 1.25 : 0.95;
    return a + pull;
  }, 0);
  const playerShare = you / (you + rivalPull);

  return { competitors, headlines, playerShare };
}
