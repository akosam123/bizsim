import { BusinessConfig, LocationConfig, MarketingTier, PriceLevel, SegmentConfig } from './types';

export const BUSINESSES: BusinessConfig[] = [
  {
    id: 'restaurant',
    name: 'Restaurant',
    tagline: 'High ticket, high touch. Reputation is everything.',
    emoji: '🍽️',
    baseTicket: 18,
    cogsRate: 0.38,
    capture: 0.5,
    wagePerStaff: 2600,
    custPerStaffPerDay: 25,
    baseCapacityPerDay: 70,
    productLineCost: 5000,
    renovationCost: 15000,
    rentMult: 1.15,
    accent: '#e05b4b',
    affinity: { locals: 1.0, commuters: 0.8, visitors: 1.3 },
    peakMonth: 12, // holiday dinners
    seasonalAmp: 0.1,
  },
  {
    id: 'convenience',
    name: 'Convenience Store',
    tagline: 'Thin margins, steady volume. Location is everything.',
    emoji: '🏪',
    baseTicket: 9.5,
    cogsRate: 0.62,
    capture: 0.9,
    wagePerStaff: 2200,
    custPerStaffPerDay: 80,
    baseCapacityPerDay: 160,
    productLineCost: 3500,
    renovationCost: 10000,
    rentMult: 1.0,
    accent: '#3d9be9',
    affinity: { locals: 1.0, commuters: 1.25, visitors: 0.7 },
    peakMonth: 7, // summer traffic
    seasonalAmp: 0.06,
  },
  {
    id: 'coffee',
    name: 'Coffee Shop',
    tagline: 'Cheap to run, fickle crowd. Novelty is everything.',
    emoji: '☕',
    baseTicket: 7.5,
    cogsRate: 0.3,
    capture: 0.65,
    wagePerStaff: 2300,
    custPerStaffPerDay: 60,
    baseCapacityPerDay: 90,
    productLineCost: 2500,
    renovationCost: 8000,
    rentMult: 0.7,
    accent: '#b07d4f',
    affinity: { locals: 0.95, commuters: 1.35, visitors: 0.85 },
    peakMonth: 1, // cold mornings
    seasonalAmp: 0.12,
  },
  {
    id: 'bakery',
    name: 'Bakery',
    tagline: 'Early mornings, loyal regulars. Consistency is everything.',
    emoji: '🥐',
    baseTicket: 7,
    cogsRate: 0.28,
    capture: 0.65,
    wagePerStaff: 2250,
    custPerStaffPerDay: 45,
    baseCapacityPerDay: 110,
    productLineCost: 2000,
    renovationCost: 7000,
    rentMult: 0.75,
    accent: '#d9995b',
    affinity: { locals: 1.35, commuters: 1.0, visitors: 0.75 },
    peakMonth: 12, // holiday baking
    seasonalAmp: 0.14,
  },
  {
    id: 'barber',
    name: 'Barbershop',
    tagline: 'Almost no goods cost — you sell skilled hours.',
    emoji: '💈',
    baseTicket: 23,
    cogsRate: 0.08,
    capture: 0.2,
    wagePerStaff: 2600,
    custPerStaffPerDay: 12,
    baseCapacityPerDay: 30,
    productLineCost: 3000,
    renovationCost: 9000,
    rentMult: 0.5,
    accent: '#7a5fc7',
    affinity: { locals: 1.4, commuters: 0.9, visitors: 0.4 },
    peakMonth: 6, // wedding season
    seasonalAmp: 0.08,
  },
];

export const LOCATIONS: LocationConfig[] = [
  {
    id: 'low',
    name: 'Quiet Town',
    blurb: 'Low population. Cheap rent, loyal locals, slow growth.',
    footTrafficPerDay: 55,
    rent: 1500,
    wageMult: 0.92,
    competitorPressure: 0.15,
    growthPerMonth: 0.004,
    segmentMix: { locals: 0.75, commuters: 0.2, visitors: 0.05 },
    populationCap: 900,
  },
  {
    id: 'average',
    name: 'Suburb',
    blurb: 'Average density. Balanced rent and steady foot traffic.',
    footTrafficPerDay: 120,
    rent: 4400,
    wageMult: 1.0,
    competitorPressure: 0.5,
    growthPerMonth: 0.007,
    segmentMix: { locals: 0.5, commuters: 0.4, visitors: 0.1 },
    populationCap: 2200,
  },
  {
    id: 'high',
    name: 'Downtown',
    blurb: 'High density. Brutal rent, huge crowds, fierce competition.',
    footTrafficPerDay: 260,
    rent: 9800,
    wageMult: 1.22,
    competitorPressure: 0.85,
    growthPerMonth: 0.01,
    segmentMix: { locals: 0.35, commuters: 0.45, visitors: 0.2 },
    populationCap: 5000,
  },
];

export const SEGMENTS: SegmentConfig[] = [
  {
    id: 'locals',
    name: 'Locals',
    priceElasticity: 0.9,
    marketingResponse: 0.6,
    fatigueSensitivity: 1.3,  // regulars get bored of the same menu fastest
    loyaltyRate: 0.06,
  },
  {
    id: 'commuters',
    name: 'Commuters',
    priceElasticity: 1.5,     // they'll walk one more block to save a dollar
    marketingResponse: 1.0,
    fatigueSensitivity: 0.8,
    loyaltyRate: 0.03,
  },
  {
    id: 'visitors',
    name: 'Visitors',
    priceElasticity: 0.6,     // they don't know local prices
    marketingResponse: 1.6,   // ...but ads are how they find you
    fatigueSensitivity: 0.2,
    loyaltyRate: 0.005,
  },
];

export const PRICE_LEVELS: { id: PriceLevel; name: string; mult: number; hint: string }[] = [
  { id: 'budget', name: 'Budget', mult: 0.75, hint: '-25% ticket' },
  { id: 'value', name: 'Value', mult: 0.9, hint: '-10% ticket' },
  { id: 'standard', name: 'Standard', mult: 1.0, hint: 'baseline' },
  { id: 'premium', name: 'Premium', mult: 1.15, hint: '+15% ticket' },
  { id: 'luxury', name: 'Luxury', mult: 1.35, hint: '+35% ticket' },
];

export const MARKETING_TIERS: { id: MarketingTier; name: string; cost: number; boost: number; desc: string }[] = [
  { id: 'none', name: 'None', cost: 0, boost: 0, desc: 'Word of mouth only' },
  { id: 'local', name: 'Local Ads', cost: 800, boost: 0.15, desc: '+~15% demand' },
  { id: 'campaign', name: 'Big Campaign', cost: 3000, boost: 0.35, desc: '+~35% demand, slows fatigue' },
];

export const STARTING_CASH = 20000;
export const STARTING_RATE = 6;
export const LOAN_CAP = 40000;
export const LOAN_STEP = 5000;
export const MAX_STORE_TIER = 3;
export const MAX_PRODUCT_LINES = 5;
export const MAX_STAFF = 14;
export const BANKRUPTCY_FLOOR = -10000;
export const DEFAULT_MONTHS = 24;
export const TAX_RATE = 0.21;          // paid quarterly on positive profit
export const LEASE_TERM = 12;          // months between rent re-pricing
export const STAFF_BONUS_PER_HEAD = 500;

// --- the ops layer: action points, owner energy, wear, expansion ---
export const AP_CAP = 12;
export const ACTIVITY_ENERGY_COST = 12;   // each hands-on activity drains the owner
export const ENERGY_REGEN_PER_MONTH = 8;  // normal sleep only gets you so far
export const BURNOUT_THRESHOLD = 20;      // below this the owner is running on fumes
export const LOAN_AP = 2;                 // walking into the bank off-schedule
export const ADS_AP = 2;                  // launching a campaign off-schedule
export const VENTURE_AP = 8;              // opening a second place is a project
export const VENTURE_COST = 25000;        // second location of the same business
export const NEW_BUSINESS_COST = 30000;   // a whole new concept costs more to learn
export const MANAGER_HIRE_COST = 3000;    // recruiter fee for an outside manager
export const MANAGER_WAGE_PREMIUM = 0.6;  // managers cost this much extra vs line staff

export const TIER_CAPACITY_MULT = [1, 1.4, 1.9];

export function businessOf(id: string): BusinessConfig {
  return BUSINESSES.find((b) => b.id === id)!;
}
export function locationOf(id: string): LocationConfig {
  return LOCATIONS.find((l) => l.id === id)!;
}
export function priceLevelOf(id: string) {
  return PRICE_LEVELS.find((p) => p.id === id)!;
}
