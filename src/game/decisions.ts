import {
  LOAN_CAP, LOAN_STEP, MAX_PRODUCT_LINES, MAX_STORE_TIER, STAFF_BONUS_PER_HEAD,
  businessOf, locationOf, priceLevelOf,
} from './config';
import { borrow, launchProductLine, payStaffBonus, renovate, repay } from './engine';
import { resolveChoice } from './events';
import { BusinessId, DecisionCard, DecisionOption, GameState, PendingChoice } from './types';

/**
 * The scenario deck, staged as interactive fiction. Every scene is played
 * by a member of the cast (src/game/cast.ts): they walk in, they talk to
 * you, you answer, they react. Four scenes a month; what you pick is what
 * you earn.
 */

export const DECISIONS_PER_MONTH = 4;

/** Months before the same scenario can come knocking again. Repairs and
 * expansions especially should NOT show up month after month. */
const COOLDOWNS: Record<string, number> = {
  'renovation-offer': 9, 'equipment': 5, 'product-launch': 4, 'rush-prep': 10,
  'landlord-visit': 7, 'victor-visits': 6, 'vega-walkthrough': 7, 'local-critic': 9,
  'catering-order': 5, 'mystery-shopper': 7, 'staff-idea': 9, 'senior-discount': 24,
  'neighbor-complaint': 7, 'partnership': 7, 'poach-attempt': 6, 'community': 5,
  'supplier-squeeze': 5, 'waste-audit': 5, 'deep-clean': 4, 'staff-conflict': 4,
  'shift-crisis': 3, 'flash-promo': 3, 'experiment': 4,
  'price-review': 3, 'marketing-review': 3, 'bank-visit': 4, 'staffing-review': 3,
};

const pickOne = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** per-business flavor so every scene talks about the RIGHT things —
 * a barbershop has no spoilage, and nobody tastes a haircut. */
interface BizFlavor {
  item: string;          // the thing customers choose from
  gear: string;          // the machine that breaks
  maker: string;         // where the work happens
  waste: string;         // what the counts reveal
  supply: string;        // what the supplier actually sells you
  sampleLabel: string;   // what you'd offer Victor for free
  sampleReaction: string;// his reaction to it
  bigOrder: string;      // the windfall gig
  bigOrderDone: string;  // Sam reporting it went well
  criticTell: string;    // how Miss June's niece says to spot the reviewer
  mysteryCover: string;  // what the mystery-shop budget covers
  mysteryFindings: string;// what the report catches
  readyPhrase: string;   // product-launch prep summary
  flowNoun: string;      // what Sam has been timing
}

const FLAVOR: Record<string, BizFlavor> = {
  restaurant: {
    item: 'menu', gear: 'walk-in fridge', maker: 'kitchen',
    waste: 'Spoilage, over-ordering… maybe worse, I don\'t want to point fingers',
    supply: 'produce and proteins',
    sampleLabel: 'Send out a plate of the house special, on you',
    sampleReaction: '*chews slowly* …That\'s annoyingly good. That is ANNOYINGLY good. *leaves without another word*',
    bigOrder: 'An office across town wants us to cater their all-hands next Friday',
    bigOrderDone: 'DONE. Delivered, devoured, applauded. That check cleared before we finished loading the van.',
    criticTell: 'always order the second-cheapest entrée and sit near the window',
    mysteryCover: 'their dinner',
    mysteryFindings: 'four minutes before anyone greeted them, the special never offered, one wobbly table',
    readyPhrase: 'Tested, tasted, priced.',
    flowNoun: 'our kitchen flow',
  },
  convenience: {
    item: 'shelf lineup', gear: 'freezer bank', maker: 'stockroom',
    waste: 'Shrinkage — damaged stock, miscounts… maybe worse, I don\'t want to point fingers',
    supply: 'wholesale stock',
    sampleLabel: 'Hand him a bag of the local goods you stock',
    sampleReaction: '*turns the jar over, reads the label* …Where do you FIND this stuff? That\'s annoyingly good sourcing. *leaves without another word*',
    bigOrder: 'A construction site up the road wants a big weekly supply run — drinks, snacks, essentials — first month paid up front',
    bigOrderDone: 'DONE. Three van loads, zero missed items, and the site manager already texted about next month.',
    criticTell: 'they\'re scouting for a "best corner stores in town" listicle and always check the fridges first',
    mysteryCover: 'a full basket',
    mysteryFindings: 'two mispriced shelves, nobody said hello, and a fridge light\'s been flickering for weeks',
    readyPhrase: 'Sourced, shelved, priced.',
    flowNoun: 'the restock flow',
  },
  coffee: {
    item: 'drink list', gear: 'espresso machine', maker: 'bar',
    waste: 'Stale beans, over-pulled shots, milk going off faster than the math says',
    supply: 'beans and dairy',
    sampleLabel: 'Pull him a flat white, on the house',
    sampleReaction: '*sips. pauses. sips again* …That\'s annoyingly good. That is ANNOYINGLY good. *leaves without another word*',
    bigOrder: 'A conference downtown wants full coffee service next Friday — urns, pastries, two baristas',
    bigOrderDone: 'DONE. Four hundred cups, zero disasters, and the check cleared before the afternoon panel.',
    criticTell: 'always order a plain cappuccino — apparently that\'s "the true test of a shop"',
    mysteryCover: 'their coffee and a pastry',
    mysteryFindings: 'four minutes in line at a quiet hour, no size asked, one wobbly table',
    readyPhrase: 'Tested, tasted, priced.',
    flowNoun: 'the bar flow',
  },
  bakery: {
    item: 'pastry case', gear: 'main oven', maker: 'kitchen',
    waste: 'Day-olds piling up, over-proofing, flour going faster than the recipes say it should',
    supply: 'flour and butter',
    sampleLabel: 'Hand him a warm croissant, on the house',
    sampleReaction: '*bites. closes eyes. opens them, betrayed* …That\'s annoyingly good. ANNOYINGLY good. *leaves without another word*',
    bigOrder: 'A wedding wants a full dessert table for two hundred guests next Saturday',
    bigOrderDone: 'DONE. Two hundred desserts, one standing ovation for the croquembouche, and the check cleared before the first dance.',
    criticTell: 'always buy the plain croissant first — "you can\'t hide behind a plain croissant," apparently',
    mysteryCover: 'a pastry box',
    mysteryFindings: 'the case half-empty by ten, day-olds not marked down, one wobbly table',
    readyPhrase: 'Tested, tasted, priced.',
    flowNoun: 'our bake schedule',
  },
  barber: {
    item: 'service list', gear: 'chair hydraulics', maker: 'shop floor',
    waste: 'Product walking off the shelf — pomade, blades, towels vanishing faster than we sell them',
    supply: 'clippers, blades, and product',
    sampleLabel: 'Give him a quick beard line-up, on the house',
    sampleReaction: '*checks the mirror. checks it again* …That\'s annoyingly precise. ANNOYINGLY precise. *leaves without another word*',
    bigOrder: 'A wedding party wants on-site grooming for twelve — cuts, shaves, the works — morning of the big day',
    bigOrderDone: 'DONE. Twelve fresh fades, one very calm groom, and the check cleared before the ceremony started.',
    criticTell: 'always book a plain classic cut, no small talk — they judge the fundamentals',
    mysteryCover: 'their cut',
    mysteryFindings: 'nine minutes past their booking, no product suggested after the cut, and the waiting bench wobbles',
    readyPhrase: 'Practiced, timed, priced.',
    flowNoun: 'the floor rotation',
  },
};

interface CardDef {
  id: string;
  category: 'ops' | 'growth' | 'strategic';
  weight: (s: GameState) => number;
  build: (s: GameState) => DecisionCard;
  /** Trades this scene does NOT belong to. Some scenes assume a place people
   * sit down in, or a weekly rhythm a shop simply doesn't have: a corner shop
   * has no dead Tuesday to wake up and runs no weekday discount. Cards tagged
   * here are never drawn for those businesses. */
  unsuited?: BusinessId[];
}

const c = (n: number, cpi: number) => Math.round(n * cpi);

const CARDS: CardDef[] = [
  // ───────────────────────── ops dilemmas ─────────────────────────
  {
    id: 'waste-audit',
    category: 'ops',
    weight: () => 1.2,
    build: (s) => {
      const f = FLAVOR[s.business];
      const audit = c(800, s.macro.cpi);
      return {
        id: 'waste-audit',
        venue: 'back',
        title: 'The numbers don\'t add up',
        speaker: 'manager',
        mood: 'worried',
        lines: [
          `Boss, got a second? I've been doing the ${f.maker} counts three weeks running and they keep coming up short.`,
          `${f.waste}. It's small each week, but it compounds.`,
        ],
        options: [
          {
            label: `Run a full audit ($${audit.toLocaleString()})`,
            hint: 'Find the leak and fix it',
            tone: 'steady', cost: audit,
            effects: { lingering: { id: 'tight-ship', label: 'Tight inventory', monthsLeft: 3, demandMult: 1, cogsMult: 0.97, good: true } },
            result: 'Found it! A standing order nobody remembered placing. Two days of counting, but our costs just came down.',
            resultMood: 'happy',
          },
          {
            label: 'Eyeball it and move on',
            hint: 'No time, no money',
            tone: 'thrifty',
            effects: { lingering: { id: 'shrinkage', label: 'Shrinkage', monthsLeft: 2, demandMult: 1, cogsMult: 1.06, good: false } },
            result: 'If you say so. But those gaps aren\'t going to close themselves…',
            resultMood: 'worried',
          },
        ],
      };
    },
  },
  {
    id: 'equipment',
    category: 'ops',
    // the "new noise" only starts once the gear has real miles on it
    weight: (s) => (s.month < 3 || s.condition >= 60 ? 0 : 0.7 + (60 - s.condition) / 40),
    build: (s) => {
      const f = FLAVOR[s.business];
      const fix = c(1400, s.macro.cpi);
      const patch = c(350, s.macro.cpi);
      const gamble = Math.random() < 0.4;
      return {
        id: 'equipment',
        venue: 'back',
        title: `The ${f.gear} is making a new noise`,
        speaker: 'manager',
        mood: 'worried',
        lines: [
          `So… the ${f.gear}. It still works. Mostly.`,
          'But it\'s developed a rattle I can only describe as "pre-funeral." Your call, boss.',
        ],
        options: [
          {
            label: `Repair it properly ($${fix.toLocaleString()})`,
            hint: 'Fixed is fixed',
            tone: 'steady', cost: fix,
            effects: { conditionDelta: 35 },
            result: 'The tech replaced a part I can\'t pronounce. Listen to that. Nothing. Beautiful, expensive silence.',
            resultMood: 'happy',
          },
          {
            label: `Cheap patch ($${patch.toLocaleString()})`,
            hint: 'Buy some time, roll the dice',
            tone: 'thrifty', cost: patch,
            effects: gamble
              ? { conditionDelta: 8, lingering: { id: 'breakdown', label: 'Equipment limping', monthsLeft: 2, demandMult: 0.93, cogsMult: 1.04, good: false } }
              : { conditionDelta: 8 },
            result: gamble
              ? 'Patched it… aaand it\'s already rattling again. This is going to bite us, I can feel it.'
              : 'Patched it. It\'s quiet — for now. I\'ll keep an ear on it.',
            resultMood: gamble ? 'worried' : 'neutral',
          },
          {
            label: 'Run it till it dies',
            hint: 'Free, famous last words',
            tone: 'thrifty',
            effects: { lingering: { id: 'breakdown', label: 'Equipment failing', monthsLeft: 2, demandMult: 0.9, cogsMult: 1.08, good: false } },
            result: 'It died on Saturday. Mid-rush. I did what I could, boss, but everything\'s slower and pricier till we deal with it.',
            resultMood: 'stern',
          },
        ],
      };
    },
  },
  {
    id: 'staff-conflict',
    category: 'ops',
    weight: (s) => (s.staff >= 2 ? 1 + (70 - s.morale) / 60 : 0),
    build: () => ({
      id: 'staff-conflict',
      venue: 'inside',
      title: 'Two of your people aren\'t speaking',
      speaker: 'manager',
      mood: 'worried',
      lines: [
        'Heads up — we\'ve got a cold war on the floor. A scheduling slight, a tone taken, nobody remembers exactly.',
        'But the silence between those two is loud enough that customers are noticing.',
      ],
      options: [
        {
          label: 'Sit them down together',
          hint: 'An hour of awkward, then air cleared',
          tone: 'steady',
          effects: { moraleDelta: 9 },
          result: 'Twenty minutes of staring at shoes, then it ALL came out. They closed together tonight — laughing. Thank you.',
          resultMood: 'happy',
        },
        {
          label: 'Let them work it out',
          hint: 'You\'re an owner, not a counselor',
          tone: 'thrifty',
          effects: { moraleDelta: -8, demandMult: 0.97 },
          result: 'They did not work it out. The chill\'s spreading to the whole shift now. Just so you know.',
          resultMood: 'stern',
        },
      ],
    }),
  },
  {
    id: 'shift-crisis',
    category: 'ops',
    weight: (s) => (s.staff >= 2 ? 1 : 0.3),
    build: (s) => {
      const ot = c(600, s.macro.cpi);
      return {
        id: 'shift-crisis',
        venue: 'inside',
        title: 'Down a person for the week',
        speaker: 'manager',
        mood: 'worried',
        lines: [
          'Bad news — family emergency, we\'re down a person all week.',
          'Which week? The busiest one of the month. Naturally. How do you want to play it?',
        ],
        options: [
          {
            label: `Cover it with overtime ($${ot.toLocaleString()})`,
            hint: 'Service holds, wallet doesn\'t',
            tone: 'steady', cost: ot,
            effects: { moraleDelta: 4 },
            result: 'The team stepped up for the extra pay. Nobody waited long all week — and they noticed you paid fair.',
            resultMood: 'happy',
          },
          {
            label: 'Stretch the remaining crew',
            hint: 'Free, but everyone feels it',
            tone: 'thrifty',
            effects: { moraleDelta: -7, demandMult: 0.95, repDelta: -2 },
            result: 'We survived. Barely. Saturday\'s line backed up, one review mentioned the wait, and everyone went home wrecked.',
            resultMood: 'stern',
          },
          {
            label: 'Work the shifts yourself',
            hint: 'The owner rolls up their sleeves',
            tone: 'bold',
            effects: { moraleDelta: 6, fatigueDelta: -2, repDelta: 1 },
            result: 'Honestly? The team loved having you on the floor. Miss June told everyone "that\'s the owner!" like you were famous.',
            resultMood: 'happy',
          },
        ],
      };
    },
  },
  {
    id: 'supplier-squeeze',
    category: 'ops',
    weight: (s) => (s.supplierDealMonths > 0 ? 0.3 : 1),
    build: (s) => {
      const f = FLAVOR[s.business];
      const lucky = Math.random() < 0.5;
      return {
        id: 'supplier-squeeze',
        venue: 'street',
        title: 'A cheaper supplier comes knocking',
        speaker: 'supplier',
        mood: 'happy',
        lines: [
          `Boss! Tony. Good to see you. Listen — I\'ll cut right to it: I can beat what you\'re paying on ${f.supply} by a real margin.`,
          'Same categories, faster truck. Samples are out back. They\'re… fine. They\'re FINE!',
        ],
        options: [
          {
            label: 'Switch to the cheap stuff',
            hint: 'Save now, risk the product',
            tone: 'thrifty',
            effects: {
              lingering: lucky
                ? { id: 'cheap-supply', label: 'Cheaper supplies', monthsLeft: 3, demandMult: 1, cogsMult: 0.92, good: true }
                : { id: 'quality-slip', label: 'Quality slipping', monthsLeft: 3, demandMult: 0.94, cogsMult: 0.92, good: false },
            },
            result: lucky
              ? 'Smart move! And hey — nobody\'s noticed a difference. You just got cheaper without getting worse.'
              : 'You won\'t regret it! …Okay, small thing. Some regulars are saying it\'s "not the same." Give it time?',
            resultMood: lucky ? 'happy' : 'worried',
          },
          {
            label: 'Use the quote to negotiate',
            hint: 'Play them against each other',
            tone: 'steady',
            effects: { lingering: { id: 'negotiated', label: 'Negotiated rates', monthsLeft: 3, demandMult: 1, cogsMult: 0.975, good: true } },
            result: 'Oh, you took my quote to your guy? Cold. COLD. …Respect, though. That\'s exactly what I\'d do.',
            resultMood: 'neutral',
          },
          {
            label: 'Stay loyal, full price',
            hint: 'Quality you can trust',
            tone: 'bold',
            effects: { repDelta: 1 },
            result: 'Loyalty, huh. Can\'t argue with it — your product stays exactly what your regulars expect. Door\'s open if you change your mind!',
            resultMood: 'neutral',
          },
        ],
      };
    },
  },
  {
    id: 'deep-clean',
    category: 'ops',
    weight: (s) => (s.inspectionDue ? 2.5 : 0.8),
    build: (s) => ({
      id: 'deep-clean',
      venue: 'inside',
      title: 'The place is looking lived-in',
      speaker: 'manager',
      mood: s.inspectionDue ? 'worried' : 'neutral',
      lines: s.inspectionDue
        ? [
          'Boss. Vega\'s coming this month. THE inspector.',
          'And every scuff and smudge in here suddenly looks like a citation to me. Do we scrub tonight or hope for mercy?',
        ]
        : [
          'Not urgent, but — look at the corners. Grime creeps in slow, then all at once.',
          'The place is announcing our deferred maintenance. Deep clean means closing early one night.',
        ],
      options: [
        {
          label: 'Close early for a deep clean',
          hint: 'Lose an evening, gleam for weeks',
          tone: 'steady',
          effects: { demandMult: 0.98, repDelta: 3, fatigueDelta: -3 },
          result: 'Four hours, three buckets, one pizza. Look at this place — it\'s REBORN. Worth every lost sale.',
          resultMood: 'happy',
        },
        {
          label: 'A quick wipe-down will do',
          hint: 'Keep the doors open',
          tone: 'thrifty',
          effects: { repDelta: s.inspectionDue ? -3 : -1 },
          result: 'Hit the visible surfaces, hoped nobody looks up. …Somebody always looks up, boss.',
          resultMood: 'worried',
        },
      ],
    }),
  },
  // ───────────────────────── growth plays ─────────────────────────
  {
    id: 'flash-promo',
    category: 'growth',
    // footfall at a corner shop doesn't have a dead midweek to revive
    unsuited: ['convenience'],
    weight: () => 1,
    build: (s) => {
      const cost = c(500, s.macro.cpi);
      return {
        id: 'flash-promo',
        venue: 'inside',
        title: 'An empty Tuesday stares back',
        speaker: 'manager',
        mood: 'neutral',
        lines: [
          'Tuesday again. You could roll a bowling ball through here.',
          `I sketched out a weekday special — flyers, a little push online. About $${cost.toLocaleString()} to do it right. Want to wake Tuesday up?`,
        ],
        options: [
          {
            label: `Run the weekday special ($${cost.toLocaleString()})`,
            hint: 'Buy some buzz',
            tone: 'bold', cost,
            effects: { demandMult: 1.08, fatigueDelta: 1 },
            result: 'Word got around by Thursday. The dead zone has a PULSE. You should\'ve seen lunch today.',
            resultMood: 'happy',
          },
          {
            label: 'Let Tuesday be Tuesday',
            hint: 'Save the money',
            tone: 'thrifty',
            result: 'Fair enough. Tuesday remains, resolutely, Tuesday.',
            resultMood: 'neutral',
          },
        ],
      };
    },
  },
  {
    id: 'partnership',
    category: 'growth',
    weight: (s) => 0.8 + locationOf(s.location).segmentMix.commuters,
    build: (s) => {
      const cost = c(700, s.macro.cpi);
      return {
        id: 'partnership',
        venue: 'street',
        title: 'Marcus has a proposition',
        speaker: 'neighbor',
        mood: 'happy',
        lines: [
          'Hey! Marcus, from the gym around the corner. Great to finally meet the owner.',
          `Here\'s my pitch: my members get a little perk here, you get a stream of new faces. Costs you about $${cost.toLocaleString()} to set up. My people are CREATURES of habit — win them once, they\'re yours.`,
        ],
        options: [
          {
            label: `Sign the partnership ($${cost.toLocaleString()})`,
            hint: 'Three months of new faces',
            tone: 'bold', cost,
            effects: { lingering: { id: 'partnership', label: 'Local partnership', monthsLeft: 3, demandMult: 1.06, cogsMult: 1, good: true } },
            result: 'Deal! You\'ll see my six-AM crowd in here by Friday. They tip well when they\'ve earned it, trust me.',
            resultMood: 'happy',
          },
          {
            label: 'Politely decline',
            hint: 'Perks cost margin',
            tone: 'thrifty',
            result: 'No hard feelings! …I\'ll ask across the street, then. They seem hungry for it.',
            resultMood: 'neutral',
          },
        ],
      };
    },
  },
  {
    id: 'experiment',
    category: 'growth',
    weight: (s) => 0.7 + s.fatigue / 80,
    build: (s) => {
      const f = FLAVOR[s.business];
      const hit = Math.random() < 0.75;
      return {
        id: 'experiment',
        venue: 'inside',
        title: 'Miss June has opinions',
        speaker: 'regular',
        mood: 'happy',
        lines: [
          'Sweetheart, sit down a minute. You know I love this place. You KNOW I do.',
          `But the ${f.item} hasn\'t changed since I started coming, and I\'ve started noticing. An old lady notices things. Try something new. Surprise me.`,
        ],
        options: [
          {
            label: 'Try something new this month',
            hint: 'Novelty has power',
            tone: 'bold',
            effects: hit ? { demandMult: 1.05, fatigueDelta: -6 } : { demandMult: 0.98, repDelta: -2 },
            result: hit
              ? 'Oh, NOW you\'re talking. I told everyone at bridge club. Half of them are coming Thursday. You\'re welcome, dear.'
              : 'Hmm. Well. It was… brave. Take it off the board, dear, and we\'ll never speak of it again.',
            resultMood: hit ? 'happy' : 'worried',
          },
          {
            label: 'Stick to what works',
            hint: 'Consistency is a brand',
            tone: 'steady',
            effects: { fatigueDelta: 1 },
            result: 'Suit yourself, dear. The usual, then. Same as always. Same… as… always.',
            resultMood: 'neutral',
          },
        ],
      };
    },
  },
  {
    id: 'community',
    category: 'growth',
    weight: (s) => 0.6 + locationOf(s.location).segmentMix.locals,
    build: (s) => {
      const cost = c(500, s.macro.cpi);
      const cause = pickOne(['the little-league team', 'the street fair committee', 'the school fundraiser', 'the neighborhood cleanup']);
      return {
        id: 'community',
        venue: 'inside',
        title: 'The neighborhood asks',
        speaker: 'regular',
        mood: 'neutral',
        lines: [
          `Dear, I\'m here on official business today. I\'m with ${cause} — don\'t laugh, it\'s very serious.`,
          `We\'re looking for a sponsor. $${cost.toLocaleString()}, your name on the banner, and the gratitude of every family in the neighborhood. Locals remember these things. We remember everything.`,
        ],
        options: [
          {
            label: `Sponsor them ($${cost.toLocaleString()})`,
            hint: 'Locals remember',
            tone: 'steady', cost,
            effects: { repDelta: 4, loyaltyDelta: 8 },
            result: 'Wonderful! I knew you were one of the good ones. Everyone will hear about this — I\'ll make certain of it.',
            resultMood: 'happy',
          },
          {
            label: 'Not this time',
            hint: 'Charity begins at solvency',
            tone: 'thrifty',
            result: 'I see. Well. Times are hard for everyone, I\'m sure. *files it away with a polite nod*',
            resultMood: 'stern',
          },
        ],
      };
    },
  },
  {
    id: 'price-review',
    category: 'growth',
    weight: () => 0.9,
    build: (s) => {
      const cur = priceLevelOf(s.priceLevel);
      const up = s.priceLevel === 'budget' ? 'value' : s.priceLevel === 'value' ? 'standard' : s.priceLevel === 'standard' ? 'premium' : 'luxury';
      const down = s.priceLevel === 'luxury' ? 'premium' : s.priceLevel === 'premium' ? 'standard' : s.priceLevel === 'standard' ? 'value' : 'budget';
      const opts: DecisionOption[] = [];
      if (s.priceLevel !== 'luxury') opts.push({
        label: `Raise prices (${up})`,
        hint: 'More per sale, fewer sales — unless your name carries it',
        tone: 'bold',
        action: { setPrice: up as any },
        result: 'New numbers are live. I watched the first few customers read them… and order anyway. So far, so good.',
        resultMood: 'neutral',
      });
      opts.push({
        label: `Hold at ${cur.name.toLowerCase()}`,
        hint: 'Predictability is comfortable',
        tone: 'steady',
        result: 'Holding. Nobody notices, which is rather the point of holding.',
        resultMood: 'neutral',
      });
      if (s.priceLevel !== 'budget') opts.push({
        label: `Cut prices (${down})`,
        hint: 'Chase volume, squeeze margin',
        tone: 'thrifty',
        action: { setPrice: down as any },
        result: 'Cuts are live. The penny-watchers found them within days. Your margins found them immediately.',
        resultMood: 'worried',
      });
      return {
        id: 'price-review',
        venue: 'office',
        title: 'Priya slides the spreadsheet over',
        speaker: 'accountant',
        mood: 'neutral',
        lines: [
          'So. Prices. Don\'t make that face — we do this every quarter.',
          `You\'re at ${cur.name.toLowerCase()} right now. Locals will forgive a bump if they love you; commuters will walk a block to save a dollar. Question is whether the market bears more, or wants less.`,
        ],
        options: opts,
      };
    },
  },
  {
    id: 'marketing-review',
    category: 'growth',
    weight: () => 0.9,
    build: (s) => {
      const local = c(800, s.macro.cpi);
      const big = c(3000, s.macro.cpi);
      return {
        id: 'marketing-review',
        venue: 'office',
        title: 'How loud should you be?',
        speaker: 'accountant',
        mood: 'neutral',
        lines: [
          'Two envelopes on my desk this morning: a media kit from the local ad network, and a quote from an actual agency.',
          `Local presence runs $${local.toLocaleString()} a month. The full campaign is $${big.toLocaleString()} — billboards, feeds, the works. Attention is for sale. How much are we buying?`,
        ],
        options: [
          {
            label: `Big campaign ($${big.toLocaleString()}/mo)`,
            hint: 'Billboards, feeds, the works',
            tone: 'bold',
            action: { setMarketing: 'campaign' },
            result: 'Signed. Two weeks from now, people you\'ve never met will know this place\'s name. I\'ll be watching whether they show up.',
            resultMood: 'neutral',
          },
          {
            label: `Local ads ($${local.toLocaleString()}/mo)`,
            hint: 'Steady, sensible presence',
            tone: 'steady',
            action: { setMarketing: 'local' },
            result: 'Sensible. Flyers, local feeds, the neighborhood paper. It works while you sleep, which is my favorite kind of working.',
            resultMood: 'happy',
          },
          {
            label: 'Go dark — word of mouth only',
            hint: 'Free, and quiet',
            tone: 'thrifty',
            action: { setMarketing: 'none' },
            result: 'Canceled everything. From here on, your customers are your advertising. Hope they\'re chatty.',
            resultMood: 'neutral',
          },
        ],
      };
    },
  },
  // ───────────────────────── strategic moves ─────────────────────────
  {
    id: 'renovation-offer',
    category: 'strategic',
    weight: (s) => {
      if (s.storeTier >= MAX_STORE_TIER || s.renovationMonthsLeft > 0) return 0;
      const last = s.history[s.history.length - 1];
      const crowded = last && last.lostToCapacity > last.customers * 0.08;
      return crowded ? 2.2 : 0.5;
    },
    build: (s) => {
      const cost = Math.round(businessOf(s.business).renovationCost * s.macro.cpi);
      return {
        id: 'renovation-offer',
        venue: 'inside',
        title: 'Dee walks the space',
        speaker: 'contractor',
        mood: 'neutral',
        lines: [
          '*taps a wall, listens* Good bones. You\'re wasting them.',
          `I watched you turn people away at the door twice while I was measuring. A bigger, better room keeps them. $${cost.toLocaleString()}, about two months of honest construction, done right the first time.`,
        ],
        options: [
          {
            label: `Start the renovation ($${cost.toLocaleString()})`,
            hint: 'Two months of dust, then more room and +8 reputation',
            tone: 'bold', action: 'renovate',
            result: '*rolls out the plans on your counter* Crew starts Monday. Two months, some dust, a little noise — then you won\'t recognize the place.',
            resultMood: 'happy',
          },
          {
            label: 'Not yet',
            hint: 'The war chest stays shut',
            tone: 'steady',
            result: 'Your call. Keep my quote — the line out your door is flattering, but flattery doesn\'t pay rent. I do callbacks.',
            resultMood: 'neutral',
          },
        ],
      };
    },
  },
  {
    id: 'product-launch',
    category: 'strategic',
    weight: (s) => (s.productLines >= MAX_PRODUCT_LINES ? 0 : 0.4 + s.fatigue / 45),
    build: (s) => {
      const f = FLAVOR[s.business];
      const cost = Math.round(businessOf(s.business).productLineCost * s.macro.cpi);
      return {
        id: 'product-launch',
        venue: 'back',
        title: `Time to reinvent the ${f.item}?`,
        speaker: 'manager',
        mood: 'happy',
        lines: [
          'Okay. Don\'t say no yet. Remember that whole new line we\'ve been testing after close? It\'s READY.',
          `${f.readyPhrase} Launch costs $${cost.toLocaleString()} all in. Boredom is the one competitor we can\'t out-price, boss.`,
        ],
        options: [
          {
            label: `Launch the new line ($${cost.toLocaleString()})`,
            hint: 'Novelty resets fatigue, raises ticket',
            tone: 'bold', action: 'productLine',
            result: 'LAUNCH DAY. Regulars photographing the new board. Someone clapped. Someone CLAPPED, boss. I feel ten feet tall.',
            resultMood: 'happy',
          },
          {
            label: 'Keep it in development',
            hint: 'Save the cash for now',
            tone: 'thrifty',
            effects: { fatigueDelta: 2 },
            result: '…Back in the binder it goes. The regulars ordered the usual today. A little less brightly, if you ask me.',
            resultMood: 'worried',
          },
        ],
      };
    },
  },
  {
    id: 'bank-visit',
    category: 'strategic',
    weight: (s) => (s.cash < 8000 ? 1.4 : s.loan > 0 && s.cash > s.loan + 15000 ? 1.2 : 0.4),
    build: (s) => {
      const opts: DecisionOption[] = [];
      if (s.loan + LOAN_STEP <= LOAN_CAP) opts.push({
        label: `Borrow $${LOAN_STEP.toLocaleString()} at ${s.interestRate.toFixed(1)}%`,
        hint: 'Fuel now, interest forever',
        tone: 'bold', action: 'borrow',
        result: 'Funds cleared before you reach the door. A pleasure. It\'s always a pleasure — that\'s rather the point of my business.',
        resultMood: 'happy',
      });
      if (s.loan > 0 && s.cash >= Math.min(LOAN_STEP, s.loan)) opts.push({
        label: `Repay $${Math.min(LOAN_STEP, s.loan).toLocaleString()}`,
        hint: 'Shrink the interest bleed',
        tone: 'steady', action: 'repay',
        result: 'Paid down. Your interest line just got a little less insulting. I\'ll admit I\'m mildly disappointed.',
        resultMood: 'neutral',
      });
      opts.push({
        label: 'Just checking in',
        hint: 'No moves today',
        tone: 'thrifty',
        result: 'Always happy to review the numbers. Do take a calendar on your way out. We had them printed.',
        resultMood: 'neutral',
      });
      return {
        id: 'bank-visit',
        venue: 'office',
        title: 'An appointment at the bank',
        speaker: 'banker',
        mood: 'neutral',
        lines: [
          `Ah — do sit. I took the liberty of printing your summary. Rates are at ${s.interestRate.toFixed(1)}%, and ${s.loan > 0 ? `you\'re carrying $${s.loan.toLocaleString()} with us` : 'your slate is admirably clean'}.`,
          'The only question I ever ask: should money be moving?',
        ],
        options: opts,
      };
    },
  },
  {
    id: 'staffing-review',
    category: 'strategic',
    weight: (s) => {
      const last = s.history[s.history.length - 1];
      if (!last) return 0.4;
      const biz = businessOf(s.business);
      const needed = Math.ceil(last.customers / 30 / biz.custPerStaffPerDay);
      return s.staff < needed ? 2.5 : s.morale < 50 ? 1.8 : 0.6;
    },
    build: (s) => {
      const biz = businessOf(s.business);
      const wage = Math.round(biz.wagePerStaff * locationOf(s.location).wageMult * s.macro.cpi);
      const bonus = Math.round(s.staff * STAFF_BONUS_PER_HEAD * s.macro.cpi);
      const opts: DecisionOption[] = [
        {
          label: `Hire another pair of hands ($${wage.toLocaleString()}/mo)`,
          hint: 'Service quality is capacity',
          tone: 'bold', action: 'hire',
          result: 'New hire fumbled everything day one, nailed it by day three. The whole team just exhaled. Good call.',
          resultMood: 'happy',
        },
        {
          label: `Pay a team bonus ($${bonus.toLocaleString()})`,
          hint: 'Morale is a multiplier',
          tone: 'steady', action: 'bonus',
          result: 'Envelopes at close of shift. Boss… everyone was five minutes EARLY this morning. I didn\'t know they could do that.',
          resultMood: 'happy',
        },
      ];
      if (s.staff > 1) opts.push({
        label: 'Trim the roster by one',
        hint: 'Save a salary, spend some trust',
        tone: 'thrifty', action: 'fire',
        result: 'It\'s done. Hard conversation. The wage bill\'s smaller… so is the warmth in the room. I\'ll hold it together.',
        resultMood: 'stern',
      });
      return {
        id: 'staffing-review',
        venue: 'inside',
        title: 'The team, considered',
        speaker: 'manager',
        mood: s.morale < 50 ? 'worried' : 'neutral',
        lines: [
          `Payroll day. ${s.staff} of us on the roster, morale sitting at about ${Math.round(s.morale)} out of 100, if you had to put a number on it. Which I just did.`,
          'Every option costs something — money, energy, or goodwill. What are we spending?',
        ],
        options: opts,
      };
    },
  },
  {
    id: 'poach-attempt',
    category: 'strategic',
    weight: (s) => (s.competitors.length > 0 && s.staff >= 2 ? 1.2 : 0),
    build: (s) => {
      const rival = s.competitors[0]?.name ?? 'the competition';
      const raise = c(300, s.macro.cpi);
      return {
        id: 'poach-attempt',
        venue: 'inside',
        title: 'Sam closes the office door',
        speaker: 'manager',
        mood: 'worried',
        lines: [
          `Boss, I need to be straight with you. ${rival} made me an offer. Real money.`,
          `I\'d rather stay. This place is… look, I built half of it with you. But "rather" is doing a lot of work in that sentence. It\'s about $${raise.toLocaleString()} more a month.`,
        ],
        options: [
          {
            label: `Match it with a raise (+$${raise.toLocaleString()}/mo)`,
            hint: 'Keep your best, pay for it',
            tone: 'steady',
            effects: { moraleDelta: 8, lingering: { id: 'raise', label: 'Payroll bump', monthsLeft: 6, demandMult: 1, cogsMult: 1.02, good: false } },
            result: '…You didn\'t even hesitate. Okay. Okay! I\'m not crying, there\'s flour in my eye. Back to work. FOREVER, apparently.',
            resultMood: 'happy',
          },
          {
            label: 'Wish them well',
            hint: 'Nobody is irreplaceable, right?',
            tone: 'thrifty',
            effects: { moraleDelta: -12, demandMult: 0.94, repDelta: -2 },
            result: '*from the doorway, apron folded on the counter* Take care of the place, yeah? …Yeah.',
            resultMood: 'stern',
          },
        ],
      };
    },
  },
  // ───────────────────────── encounters ─────────────────────────
  {
    id: 'landlord-visit',
    category: 'ops',
    weight: (s) => 0.6 + (s.leaseMonthsLeft <= 3 ? 0.8 : 0),
    build: (s) => {
      const spruce = c(900, s.macro.cpi);
      return {
        id: 'landlord-visit',
        venue: 'street',
        title: 'Mrs. Okafor inspects her property',
        speaker: 'landlord',
        mood: 'stern',
        lines: [
          '*runs a gloved finger along the window frame* Mm. I was in the neighborhood. I own half of it, after all.',
          `The frontage is looking… loved. Which is a landlord\'s way of saying tired. A tenant who maintains my property is a tenant I remember warmly at lease time.`,
        ],
        options: [
          {
            label: `Spruce up the frontage ($${spruce.toLocaleString()})`,
            hint: 'Curb appeal + a warm lease memory',
            tone: 'steady', cost: spruce,
            effects: { repDelta: 2, lingering: { id: 'fresh-frontage', label: 'Fresh frontage', monthsLeft: 3, demandMult: 1.04, cogsMult: 1, good: true } },
            result: 'Fresh paint, polished glass. *she almost smiles* You take care of things. I shall make a note of it.',
            resultMood: 'happy',
          },
          {
            label: 'It has character, Mrs. Okafor',
            hint: 'Free, but she remembers everything',
            tone: 'thrifty',
            effects: { repDelta: -1 },
            result: '"Character." *writes something in a small black book* I also keep books, you know. Good day.',
            resultMood: 'stern',
          },
        ],
      };
    },
  },
  {
    id: 'victor-visits',
    category: 'growth',
    weight: (s) => (s.competitors.length > 0 ? 1.1 : 0),
    build: (s) => {
      const f = FLAVOR[s.business];
      const rival = s.competitors[0]?.name ?? 'his place';
      const payoff = c(2500, s.macro.cpi);
      return {
        id: 'victor-visits',
        venue: 'inside',
        title: 'The competition walks in',
        speaker: 'rival',
        mood: 'happy',
        lines: [
          `Nice place. Small, but nice. Victor — I run ${rival}. Thought I\'d finally see what the fuss is about.`,
          `Relax, I\'m not here to steal anything. Well. Not NOTHING. I\'ll pay $${payoff.toLocaleString()} for an hour of your time — how you run your operation. Call it… professional curiosity.`,
        ],
        options: [
          {
            label: `Take the $${payoff.toLocaleString()}, talk shop`,
            hint: 'Easy money, sharper rival',
            tone: 'thrifty', cost: -payoff,
            effects: { lingering: { id: 'briefed-rival', label: 'Rival knows your playbook', monthsLeft: 4, demandMult: 0.95, cogsMult: 1, good: false } },
            result: '*taking notes* Fascinating. FASCINATING. You\'ve been very helpful. You\'ll see just how helpful shortly.',
            resultMood: 'happy',
          },
          {
            label: 'Walk him out, politely',
            hint: 'Your secrets stay yours',
            tone: 'steady',
            effects: { repDelta: 1, moraleDelta: 3 },
            result: '*at the door* Worth a try. It\'s always worth a try. See you around, neighbor — the market decides these things anyway.',
            resultMood: 'neutral',
          },
          {
            label: f.sampleLabel,
            hint: 'Confidence is a message',
            tone: 'bold',
            effects: { repDelta: 2 },
            result: f.sampleReaction,
            resultMood: 'worried',
          },
        ],
      };
    },
  },
  {
    id: 'vega-walkthrough',
    category: 'ops',
    weight: (s) => (s.inspectionDue ? 0 : 0.6),
    build: (s) => {
      const fix = c(600, s.macro.cpi);
      return {
        id: 'vega-walkthrough',
        venue: 'inside',
        title: 'Inspector Vega, off duty. Mostly.',
        speaker: 'inspector',
        mood: 'neutral',
        lines: [
          'Off the record — I\'m not inspecting today. I had lunch nearby and my feet walked me here out of habit.',
          'But habits notice things. Want me to point out what I\'d flag if I WERE working? Free advice, one-time offer.',
        ],
        options: [
          {
            label: `Yes — and fix what she finds ($${fix.toLocaleString()})`,
            hint: 'Cheaper than a citation later',
            tone: 'steady', cost: fix,
            effects: { repDelta: 2, moraleDelta: 2 },
            result: 'Three small things, all fixable, all fixed by Friday. *nods* When I DO come back, this will be a boring visit. I love boring visits.',
            resultMood: 'happy',
          },
          {
            label: 'We run a tight ship already',
            hint: 'Confident — hopefully correctly',
            tone: 'thrifty',
            effects: Math.random() < 0.35
              ? { lingering: { id: 'unseen-issue', label: 'Something\'s off in back', monthsLeft: 2, demandMult: 1, cogsMult: 1.04, good: false } }
              : {},
            result: '*shrugs* Your call. Ships always look tight from the deck. It\'s the hull you want to worry about.',
            resultMood: 'neutral',
          },
        ],
      };
    },
  },
  {
    id: 'catering-order',
    category: 'growth',
    unsuited: ['barber'],
    weight: () => 0.9,
    build: (s) => {
      const f = FLAVOR[s.business];
      const pay = c(1800, s.macro.cpi);
      return {
        id: 'catering-order',
        venue: 'back',
        title: 'A very big order',
        speaker: 'manager',
        mood: 'happy',
        lines: [
          `Boss! Big one just came in. ${f.bigOrder}. $${pay.toLocaleString()}, paid up front.`,
          'Catch is, it\'s huge. That\'s two brutal days on top of regular service. The team can do it. The team will FEEL it.',
        ],
        options: [
          {
            label: `Take the order (+$${pay.toLocaleString()})`,
            hint: 'A windfall, paid in sweat',
            tone: 'steady', cost: -pay,
            effects: { moraleDelta: -5, fatigueDelta: 1, repDelta: 2 },
            result: f.bigOrderDone,
            resultMood: 'happy',
          },
          {
            label: 'Too much strain — pass',
            hint: 'Protect the team and the regulars',
            tone: 'thrifty',
            effects: { moraleDelta: 2 },
            result: 'I\'ll tell them we\'re booked. Honestly? Probably right. The regulars come first, and the team could use a normal week.',
            resultMood: 'neutral',
          },
        ],
      };
    },
  },
  {
    id: 'local-critic',
    category: 'growth',
    unsuited: ['convenience', 'barber'],
    weight: (s) => 0.5 + s.reputation / 150,
    build: (s) => {
      const f = FLAVOR[s.business];
      const prep = c(400, s.macro.cpi);
      const prepped = Math.random() < 0.7;
      const natural = Math.random() < 0.5;
      return {
        id: 'local-critic',
        venue: 'inside',
        title: 'Miss June brings intelligence',
        speaker: 'regular',
        mood: 'worried',
        lines: [
          'Dear. Lean in. You didn\'t hear this from me — my niece works at the paper.',
          `A REVIEWER is coming this month. Anonymous, but my niece says they ${f.criticTell}. What are you going to do about it?`,
        ],
        options: [
          {
            label: `Drill the team all week ($${prep.toLocaleString()})`,
            hint: 'Leave nothing to chance',
            tone: 'steady', cost: prep,
            effects: prepped
              ? { repDelta: 4, moraleDelta: -2, lingering: { id: 'good-review', label: 'Glowing write-up', monthsLeft: 2, demandMult: 1.06, cogsMult: 1, good: true } }
              : { moraleDelta: -4 },
            result: prepped
              ? 'The write-up is in! "Precise, warm, worth crossing town for." I\'m framing it. I\'m framing TWO.'
              : 'All that drilling and… no review ever ran. My niece thinks they got reassigned. The team is exhausted for nothing, dear.',
            resultMood: prepped ? 'happy' : 'worried',
          },
          {
            label: 'We are what we are — act natural',
            hint: 'A coin flip with your reputation',
            tone: 'bold',
            effects: natural
              ? { repDelta: 3 }
              : { repDelta: -3 },
            result: natural
              ? 'The review ran: "unpretentious and genuine." See? I always said you were genuine. I\'ll take my usual, dear.'
              : 'Oh dear. "Uneven on a Tuesday." UNEVEN. Well — nobody reads the Tuesday edition anyway. *pats your hand*',
            resultMood: natural ? 'happy' : 'worried',
          },
        ],
      };
    },
  },
  {
    id: 'staff-idea',
    category: 'ops',
    weight: (s) => (s.morale >= 50 ? 0.9 : 0.3),
    build: (s) => {
      const f = FLAVOR[s.business];
      const cost = c(600, s.macro.cpi);
      return {
        id: 'staff-idea',
        venue: 'back',
        title: 'Sam has been sketching again',
        speaker: 'manager',
        mood: 'happy',
        lines: [
          `Okay hear me out. I\'ve been timing ${f.flowNoun} for two weeks. We cross paths eleven times an hour back here. ELEVEN.`,
          `Rearrange the stations — about $${cost.toLocaleString()} in shelving and a weekend — and I can get us twenty minutes back per shift. I made a diagram. There\'s a laminated version.`,
        ],
        options: [
          {
            label: `Fund the reorganization ($${cost.toLocaleString()})`,
            hint: 'Trust the laminated diagram',
            tone: 'steady', cost,
            effects: { moraleDelta: 6, lingering: { id: 'smooth-flow', label: 'Streamlined prep', monthsLeft: 4, demandMult: 1, cogsMult: 0.97, good: true } },
            result: 'IT WORKS. It works exactly like the diagram. Nobody has collided in three days. I have never been happier.',
            resultMood: 'happy',
          },
          {
            label: 'Interesting — maybe next quarter',
            hint: 'Free, slightly deflating',
            tone: 'thrifty',
            effects: { moraleDelta: -3 },
            result: '*rolls up the diagram very slowly* Sure. Next quarter. I\'ll just… keep colliding with people. Eleven times an hour.',
            resultMood: 'worried',
          },
        ],
      };
    },
  },
  {
    id: 'neighbor-complaint',
    category: 'ops',
    weight: () => 0.6,
    build: (s) => {
      const fix = c(250, s.macro.cpi);
      return {
        id: 'neighbor-complaint',
        venue: 'street',
        title: 'Marcus, less cheerful than usual',
        speaker: 'neighbor',
        mood: 'stern',
        lines: [
          'Hey. Neighbor to neighbor — your late crew\'s been leaving the bins out past midnight, and the lids don\'t shut.',
          'My six-AM class does NOT love the smell, and two of them mentioned it by name. Yours, not mine. Small thing now. Won\'t stay small.',
        ],
        options: [
          {
            label: `Sort the bins properly ($${fix.toLocaleString()})`,
            hint: 'Good fences, good neighbors',
            tone: 'steady', cost: fix,
            effects: { repDelta: 2 },
            result: 'THAT\'S all I\'m asking. New lids, new schedule, done. First smoothie\'s on me if you ever brave one.',
            resultMood: 'happy',
          },
          {
            label: 'Bins are bins, Marcus',
            hint: 'Free, and neighborly relations sour',
            tone: 'thrifty',
            effects: { repDelta: -3, loyaltyDelta: -6 },
            result: '*long exhale* Okay. Okay! Just know my members talk to YOUR customers. That\'s all I\'ll say. Bins are bins.',
            resultMood: 'stern',
          },
        ],
      };
    },
  },
  {
    id: 'senior-discount',
    category: 'growth',
    // a standing weekday-morning rate for a club of regulars belongs to places
    // people sit down in, not to a shop selling to whoever walks past
    unsuited: ['convenience'],
    weight: (s) => 0.4 + locationOf(s.location).segmentMix.locals * 0.8,
    build: () => ({
      id: 'senior-discount',
      venue: 'inside',
      title: 'A delegation of regulars',
      speaker: 'regular',
      mood: 'happy',
      lines: [
        'Dear, the bridge club took a vote — don\'t look alarmed, you won.',
        'We\'d like a little regulars\' discount. Nothing dramatic. Ten percent, weekday mornings. In exchange you get us, forever, and we are EXTREMELY loyal and EXTREMELY punctual.',
      ],
      options: [
        {
          label: 'Regulars\' discount, weekday mornings',
          hint: 'Thinner margin, thicker loyalty',
          tone: 'steady',
          effects: { loyaltyDelta: 14, lingering: { id: 'regulars-club', label: 'Regulars\' club', monthsLeft: 6, demandMult: 1.02, cogsMult: 1.02, good: true } },
          result: 'WONDERFUL. I\'ll tell the club. You\'ve just acquired eleven of the most reliable customers in the neighborhood, dear. We take attendance.',
          resultMood: 'happy',
        },
        {
          label: 'Everyone pays the same here',
          hint: 'Fair, firm, a little chilly',
          tone: 'thrifty',
          effects: { loyaltyDelta: -4 },
          result: '*sniffs* Principled. The club respects principle. The club also remembers, dear. We\'ll see you Tuesday regardless.',
          resultMood: 'stern',
        },
      ],
    }),
  },
  {
    id: 'rush-prep',
    category: 'strategic',
    weight: (s) => {
      const cal = ((s.month + 2) % 12) + 1; // next month, calendar-aligned
      const biz = businessOf(s.business);
      const dist = Math.min(Math.abs(cal - biz.peakMonth), 12 - Math.abs(cal - biz.peakMonth));
      return dist <= 1 ? 1.6 : 0.2;
    },
    build: (s) => {
      const stock = c(700, s.macro.cpi);
      const lean = Math.random() < 0.35;
      return {
        id: 'rush-prep',
        venue: 'back',
        title: 'The busy season is coming',
        speaker: 'supplier',
        mood: 'neutral',
        lines: [
          'Boss. Calendar check — your big season\'s almost here, and everyone orders from me the same desperate week. Every year. Like clockwork.',
          `Pre-order now at $${stock.toLocaleString()} and I lock your stock at today\'s prices, delivered early. Or ride your luck with everyone else. I\'ll love you either way, but one of you will be crying in three weeks.`,
        ],
        options: [
          {
            label: `Pre-order the season\'s stock ($${stock.toLocaleString()})`,
            hint: 'Locked prices, zero scramble',
            tone: 'steady', cost: stock,
            effects: { lingering: { id: 'stocked-up', label: 'Season stocked', monthsLeft: 2, demandMult: 1, cogsMult: 0.94, good: true } },
            result: 'Smart. SMART. Your pallet\'s already got your name on it. Watch everyone else fight over the leftovers in a few weeks.',
            resultMood: 'happy',
          },
          {
            label: 'We\'ll ride our luck',
            hint: 'Keep the cash, roll the dice',
            tone: 'thrifty',
            effects: lean
              ? { lingering: { id: 'stockout', label: 'Supply scramble', monthsLeft: 2, demandMult: 0.95, cogsMult: 1.05, good: false } }
              : {},
            result: lean
              ? '*three weeks later, on the phone* Yeahhh, so, about stock… everyone ordered at once. Like I said. Crying week.'
              : 'Luck held! This year. It held THIS year. I\'m writing that down for next year\'s pitch.',
            resultMood: lean ? 'worried' : 'neutral',
          },
        ],
      };
    },
  },
  {
    id: 'mystery-shopper',
    category: 'ops',
    weight: (s) => (s.staff >= 2 ? 0.6 : 0.2),
    build: (s) => {
      const f = FLAVOR[s.business];
      const bonus = c(300, s.macro.cpi);
      const caught = Math.random() < 0.5;
      return {
        id: 'mystery-shopper',
        venue: 'office',
        title: 'A test of the ordinary Tuesday',
        speaker: 'accountant',
        mood: 'neutral',
        lines: [
          'Management idea for you. Cheap one, even — you know I don\'t bring you expensive ideas.',
          `Send a friend in as a mystery shopper. $${bonus.toLocaleString()} covers ${f.mysteryCover} and a small thank-you. You\'ll learn what a stranger\'s Tuesday actually feels like, without you standing there making everyone behave.`,
        ],
        options: [
          {
            label: `Run the mystery shop ($${bonus.toLocaleString()})`,
            hint: 'The truth, cheaply',
            tone: 'steady', cost: bonus,
            effects: caught
              ? { moraleDelta: -2, lingering: { id: 'service-tune', label: 'Service tuned up', monthsLeft: 3, demandMult: 1.03, cogsMult: 1, good: true } }
              : { moraleDelta: 3, repDelta: 1 },
            result: caught
              ? `Report\'s in: ${f.mysteryFindings}. All fixable — and now we\'re fixing them.`
              : 'Report\'s in: essentially flawless. I\'ll admit I\'m a little disappointed. The team earned this one — tell them.',
            resultMood: caught ? 'neutral' : 'happy',
          },
          {
            label: 'I trust what I see',
            hint: 'Free, and comfortably blind',
            tone: 'thrifty',
            result: 'Noted. For the record: everyone behaves when the owner\'s watching. That\'s not data, that\'s theater. But noted.',
            resultMood: 'neutral',
          },
        ],
      };
    },
  },
];

/** Event choices get staged as scenes too, with the right character delivering them. */
export function choiceToCard(choice: PendingChoice): DecisionCard {
  const staging: Record<string, { speaker: DecisionCard['speaker']; mood: DecisionCard['mood']; venue: DecisionCard['venue']; lines: string[] }> = {
    'bad-press': {
      speaker: 'regular',
      mood: 'worried',
      venue: 'inside',
      lines: [
        'Dear. Sit down. Have you SEEN what they\'re saying online?',
        'Some reviewer with far too many followers tore this place apart. It\'s spreading. Bridge club is already asking me about it. How are you going to answer?',
      ],
    },
    'supplier-deal': {
      speaker: 'supplier',
      mood: 'happy',
      venue: 'street',
      lines: [
        'Big day, boss. Head office finally approved what I\'ve been pushing for: a real contract, just for you.',
        'Lock in 8% below market for six months. One grand to onboard, and supply spikes can\'t touch you. I pulled strings for this!',
      ],
    },
    'influencer': {
      speaker: 'influencer',
      mood: 'happy',
      venue: 'inside',
      lines: [
        'Okay so — hi, I\'m Zoe, you\'ve maybe seen my stuff? Two hundred thousand locals follow where I eat and shop.',
        'I want to feature THIS place. The vibe is so real. Two thousand for the full treatment. Fair warning: my people will absolutely mob you, and they\'ll expect something new next visit.',
      ],
    },
  };
  const stage = staging[choice.id] ?? {
    speaker: 'manager' as const,
    mood: 'neutral' as const,
    venue: 'inside' as const,
    lines: [choice.body],
  };
  return {
    id: choice.id,
    title: choice.headline.replace(/^[^\w]*/, ''),
    speaker: stage.speaker,
    mood: stage.mood,
    venue: stage.venue,
    lines: stage.lines,
    fromEvent: true,
    options: choice.options.map((o, i) => ({
      label: o.label,
      hint: o.hint,
      tone: i === 0 ? 'bold' : 'thrifty',
      result: '',
    })),
  };
}

/** Spoken reactions for event-scene picks (resolveChoice owns the mechanics). */
export function eventResponseLine(choiceId: string, optionIndex: number): { line: string; mood: DecisionCard['mood'] } {
  const table: Record<string, { line: string; mood: DecisionCard['mood'] }[]> = {
    'bad-press': [
      { line: 'A public apology AND retraining? Good. That\'s how my generation did it. I\'ll tell bridge club the matter is handled.', mood: 'happy' },
      { line: 'Ignore it?! Dear, that story is going to circulate like a casserole recipe. Don\'t say I didn\'t warn you.', mood: 'stern' },
    ],
    'supplier-deal': [
      { line: 'THERE it is! Signed and locked. Six months of prices nobody else on this street is getting. You\'re my favorite stop, don\'t tell the others.', mood: 'happy' },
      { line: 'Staying flexible, huh? I get it, I get it. Offer stands till head office notices I made it.', mood: 'neutral' },
    ],
    'influencer': [
      { line: 'Posted! It\'s already doing numbers. Brace yourself — my people are VERY enthusiastic and slightly feral. Good luck!!', mood: 'happy' },
      { line: 'Passing on free fame? Bold. Respect the confidence. My followers will find somewhere else to swarm, I guess.', mood: 'neutral' },
    ],
  };
  return table[choiceId]?.[optionIndex] ?? { line: 'Consider it done.', mood: 'neutral' };
}

/** Draw this month's scenes: event response first, then a contextual mix. */
export function drawCards(s: GameState): DecisionCard[] {
  const cards: DecisionCard[] = [];
  if (s.pendingChoice) cards.push(choiceToCard(s.pendingChoice));

  const byCat = (cat: CardDef['category']) => CARDS.filter((d) => d.category === cat);
  const drawn = new Set<string>();
  const speakersUsed = new Set(cards.map((card) => card.speaker));
  const drawFrom = (pool: CardDef[], anySpeaker = false): DecisionCard | null => {
    const avail = pool.filter((d) => !drawn.has(d.id) && (s.cooldowns?.[d.id] ?? 0) <= 0
      && !(d.unsuited ?? []).includes(s.business));
    const weights = avail.map((d) => d.weight(s));
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (let i = 0; i < avail.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        const built = avail[i].build(s);
        // one appearance per character per month, so the floor never shows twins
        if (!anySpeaker && speakersUsed.has(built.speaker)) {
          drawn.add(avail[i].id);
          return drawFrom(pool, false) ?? drawFrom(pool, true);
        }
        drawn.add(avail[i].id);
        speakersUsed.add(built.speaker);
        return built;
      }
    }
    return null;
  };

  // shape of a month: ops reality, a growth play, a strategic call, then wildcard
  const shape: CardDef['category'][] = ['ops', 'growth', 'strategic', Math.random() < 0.5 ? 'ops' : 'growth'];
  for (const cat of shape) {
    if (cards.length >= DECISIONS_PER_MONTH) break;
    const card = drawFrom(byCat(cat)) ?? drawFrom(CARDS);
    if (card) cards.push(card);
  }
  while (cards.length < DECISIONS_PER_MONTH) {
    const card = drawFrom(CARDS);
    if (!card) break;
    cards.push(card);
  }
  return cards.slice(0, DECISIONS_PER_MONTH);
}

/**
 * Apply the player's pick. Instant costs and actions hit the state now;
 * this-month effects accumulate into the plan for endMonth to consume.
 */
export function applyOption(s: GameState, card: DecisionCard, optionIndex: number): GameState {
  // event-born scenes resolve through the event system
  if (card.fromEvent) {
    const resolved = resolveChoice(s, optionIndex).state;
    const tone = card.options[optionIndex]?.tone;
    const stats = tone ? { ...resolved.choiceStats, [tone]: (resolved.choiceStats?.[tone] ?? 0) + 1 } : resolved.choiceStats;
    return { ...resolved, choiceStats: stats, plan: { ...resolved.plan, decisionsMade: resolved.plan.decisionsMade + 1 } };
  }

  const opt = card.options[optionIndex];
  if (!opt) return s;
  let next: GameState = { ...s, plan: { ...s.plan }, effects: [...s.effects], log: [...s.log] };

  if (opt.cost) next.cash -= opt.cost;

  if (opt.action) {
    if (opt.action === 'renovate') next = { ...renovate(next), plan: next.plan };
    else if (opt.action === 'productLine') next = { ...launchProductLine(next), plan: next.plan };
    else if (opt.action === 'borrow') next = { ...borrow(next), plan: next.plan };
    else if (opt.action === 'repay') next = { ...repay(next), plan: next.plan };
    else if (opt.action === 'bonus') next = { ...payStaffBonus(next), plan: next.plan };
    else if (opt.action === 'hire') next.staff = Math.min(14, next.staff + 1);
    else if (opt.action === 'fire') { next.staff = Math.max(1, next.staff - 1); next.morale = Math.max(0, next.morale - 5); }
    else if ('setPrice' in opt.action) next.priceLevel = opt.action.setPrice;
    else if ('setMarketing' in opt.action) next.marketingTier = opt.action.setMarketing;
  }

  const fx = opt.effects;
  if (fx) {
    if (fx.demandMult) next.plan.demandMult *= fx.demandMult;
    if (fx.cogsMult) next.plan.cogsMult *= fx.cogsMult;
    if (fx.repDelta) next.plan.repDelta += fx.repDelta;
    if (fx.moraleDelta) next.plan.moraleDelta += fx.moraleDelta;
    if (fx.fatigueDelta) next.plan.fatigueDelta += fx.fatigueDelta;
    if (fx.loyaltyDelta) next.plan.loyaltyDelta += fx.loyaltyDelta;
    if (fx.conditionDelta) next.condition = Math.max(0, Math.min(100, next.condition + fx.conditionDelta));
    if (fx.lingering) next.effects.push({ ...fx.lingering });
  }

  next.plan.decisionsMade += 1;
  next.cooldowns = { ...next.cooldowns, [card.id]: COOLDOWNS[card.id] ?? 3 };
  if (opt.tone) next.choiceStats = { ...next.choiceStats, [opt.tone]: (next.choiceStats?.[opt.tone] ?? 0) + 1 };
  return next;
}

export function emptyPlan() {
  return { demandMult: 1, cogsMult: 1, repDelta: 0, moraleDelta: 0, fatigueDelta: 0, loyaltyDelta: 0, decisionsMade: 0 };
}
