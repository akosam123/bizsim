import { AvatarSpec, CharacterId, Mood } from './cast';

export type BusinessId = 'restaurant' | 'convenience' | 'coffee' | 'bakery' | 'barber';
export type LocationId = 'low' | 'average' | 'high';
export type PriceLevel = 'budget' | 'value' | 'standard' | 'premium' | 'luxury';
export type MarketingTier = 'none' | 'local' | 'campaign';
export type SegmentId = 'locals' | 'commuters' | 'visitors';
export type EconomyPhase = 'boom' | 'steady' | 'downturn' | 'recession';

export interface BusinessConfig {
  id: BusinessId;
  name: string;
  tagline: string;
  emoji: string;
  baseTicket: number;        // average $ per customer at CPI 1.0, standard price
  cogsRate: number;          // cost of goods as share of revenue
  capture: number;           // share of local foot traffic that considers you
  wagePerStaff: number;      // monthly wage per employee at CPI 1.0
  custPerStaffPerDay: number;
  baseCapacityPerDay: number;
  productLineCost: number;
  renovationCost: number;
  rentMult: number;          // footprint: share of the location's market rent you pay
  accent: string;
  /** how much each segment likes this kind of business (demand multiplier) */
  affinity: Record<SegmentId, number>;
  /** month (1-12) of peak season; demand swings ±seasonalAmp around it */
  peakMonth: number;
  seasonalAmp: number;
}

export interface LocationConfig {
  id: LocationId;
  name: string;
  blurb: string;
  footTrafficPerDay: number;
  rent: number;              // at CPI 1.0; leases re-price annually
  wageMult: number;          // labor market premium
  competitorPressure: number; // 0-1, how attractive the market is to rivals
  growthPerMonth: number;
  segmentMix: Record<SegmentId, number>; // shares, sum to 1
  populationCap: number;     // ceiling on loyal-customer stock
}

export interface SegmentConfig {
  id: SegmentId;
  name: string;
  priceElasticity: number;   // demand ~ priceMult^-elasticity
  marketingResponse: number; // scales marketing boost
  fatigueSensitivity: number;// scales fatigue penalty
  loyaltyRate: number;       // share of happy customers who become regulars
}

export interface Macro {
  phase: EconomyPhase;
  monthsInPhase: number;
  cpi: number;               // price index, starts at 1.0
  inflationYoY: number;      // trailing annualized, for display
  confidence: number;        // demand multiplier from consumer mood
  rateAnchor: number;        // where the interest rate is being pulled
}

export interface Competitor {
  id: string;
  name: string;
  stance: 'discount' | 'quality' | 'copycat';
  strength: number;          // attractiveness weight vs. yours
  monthsActive: number;
}

export interface ActiveEffect {
  id: string;
  label: string;
  monthsLeft: number;
  demandMult: number;
  cogsMult: number;
  good: boolean;
}

/** An event that demands a decision from the player before the month closes. */
export interface PendingChoice {
  id: string;
  headline: string;
  body: string;
  options: { label: string; hint: string }[];
}

/** Effects a decision option feeds into the month that is about to close. */
export interface OptionEffects {
  demandMult?: number;   // this month's demand
  cogsMult?: number;     // this month's cost of goods
  repDelta?: number;
  moraleDelta?: number;
  fatigueDelta?: number;
  loyaltyDelta?: number;
  conditionDelta?: number; // repairs & upkeep restore the premises
  lingering?: ActiveEffect; // multi-month effect
}

export type CardAction =
  | 'renovate' | 'productLine' | 'borrow' | 'repay' | 'bonus' | 'hire' | 'fire'
  | { setPrice: PriceLevel }
  | { setMarketing: MarketingTier };

export interface DecisionOption {
  label: string;
  hint?: string;
  /** personality of the pick — used by the balance harness, never shown as judgment */
  tone: 'bold' | 'steady' | 'thrifty';
  cost?: number;          // instant cash out (CPI-scaled at generation time)
  effects?: OptionEffects;
  action?: CardAction;
  result: string;         // the character's spoken reaction to this pick
  resultMood?: Mood;      // their expression while saying it
}

export type Venue = 'street' | 'inside' | 'back' | 'office';
/** Everywhere the player can physically stand — scenario venues plus
 * city-only places (the bank lobby is enterable but no cards play there). */
export type WorldRoom = Venue | 'bank';

export interface DecisionCard {
  id: string;
  aiGenerated?: boolean;  // written live by the AI scenario director
  title: string;
  speaker: CharacterId;   // who plays this scene
  mood: Mood;             // their opening expression
  venue?: Venue;          // where the scene is staged (default: inside)
  lines: string[];        // dialogue beats before the choice
  options: DecisionOption[];
  /** cards born from a PendingChoice event resolve through events.resolveChoice */
  fromEvent?: boolean;
}

/** Accumulated consequences of this month's decisions; consumed by endMonth. */
export interface MonthPlan {
  demandMult: number;
  cogsMult: number;
  repDelta: number;
  moraleDelta: number;
  fatigueDelta: number;
  loyaltyDelta: number;
  decisionsMade: number;
}

export interface SegmentSnapshot {
  id: SegmentId;
  customers: number;         // served this month from this segment
}

export interface MonthRecord {
  month: number;
  customers: number;
  loyalCustomers: number;
  lostToCapacity: number;
  revenue: number;
  cogs: number;
  rent: number;
  wages: number;
  overhead: number;      // utilities, insurance, card fees — the quiet bleed
  marketingCost: number;
  interestPaid: number;
  taxes: number;
  profit: number;
  cash: number;
  reputation: number;
  fatigue: number;
  morale: number;
  interestRate: number;
  cpi: number;
  phase: EconomyPhase;
  marketShare: number;       // your share of contested demand, 0-1
  segments: SegmentSnapshot[];
  eventLabels: string[];
  ventureProfit?: number;    // net from second locations this month
}

/** A real person on the payroll — not just a headcount. */
export interface StaffMember {
  id: string;
  name: string;
  skill: number;          // 1-5, grows slowly with tenure and hustle
  hustle: number;         // 0-100 work ethic, visible to the owner
  morale: number;         // personal morale — promotions missed, bonuses paid
  monthsEmployed: number;
  role: 'staff' | 'manager';
}

/** A second location (or a whole new business) run by a manager you gave up. */
export interface Venture {
  id: string;
  name: string;
  business: BusinessId;
  managerName: string;
  managerSkill: number;
  openedMonth: number;
}

export interface GameState {
  ownerName: string;
  avatar: AvatarSpec;
  business: BusinessId;
  location: LocationId;
  month: number;
  maxMonths: number;
  cash: number;
  loan: number;
  interestRate: number;
  reputation: number;
  fatigue: number;
  morale: number;            // staff morale 0-100
  loyalty: number;           // stock of regular customers
  priceLevel: PriceLevel;
  marketingTier: MarketingTier;
  staff: number;
  storeTier: number;
  productLines: number;
  macro: Macro;
  competitors: Competitor[];
  effects: ActiveEffect[];
  rentCurrent: number;       // locked by lease
  leaseMonthsLeft: number;
  quarterProfit: number;     // accumulates until tax month
  inspectionDue: boolean;    // health-inspection chain armed
  supplierDealMonths: number;// months left on locked supplier contract
  pendingChoice: PendingChoice | null;
  cooldowns: Record<string, number>; // scenario id → months before it can return
  choiceStats: { bold: number; steady: number; thrifty: number }; // how this owner decides
  renovationMonthsLeft: number;      // >0 while the construction crew is in
  // --- ops layer: wear, the owner's own hands, and the people ---
  roster: StaffMember[];      // the actual team (length mirrors `staff`)
  unattendedStreak: number;   // consecutive months run without the owner
  energy: number;             // the owner's own tank, 0-100
  ap: number;                 // action points, earned by pitching in
  condition: number;          // premises & equipment wear, 0-100
  activitiesDone: string[];   // activities already done this month
  ventures: Venture[];        // locations running without you
  // --- barbershops only: a booth-rental business, not a wage business ---
  chairs: number;             // stations in the shop
  barbers: import('./barber').Barber[];  // who rents them
  ownerChair: boolean;        // are you cutting hair yourself
  chairApplicants: import('./barber').ChairApplicant[]; // barbers asking for a seat
  // --- the story clock ---
  plan: MonthPlan;             // consequences of this month's decisions so far
  currentCards: DecisionCard[];// this month's scenario deck
  completedCards: number[];    // indices already played (any order — you walk to them)
  monthIntro: string;          // narration that opened this month
  monthStory: string[];        // the month's running narrative (intro + results)
  activeMs: number;            // active play time this month
  lastPlayedAt: number;        // epoch ms, for offline catch-up
  awayRecap: string | null;    // "while you were away" summary to show once
  history: MonthRecord[];
  log: string[];
  gameOver: boolean;
  bankrupt: boolean;
  saveVersion: number;
}
