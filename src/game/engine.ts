import {
  BANKRUPTCY_FLOOR, BURNOUT_THRESHOLD, DEFAULT_MONTHS, ENERGY_REGEN_PER_MONTH,
  LEASE_TERM, LOAN_CAP, LOAN_STEP, MANAGER_WAGE_PREMIUM,
  MARKETING_TIERS, MAX_PRODUCT_LINES, MAX_STAFF, MAX_STORE_TIER,
  SEGMENTS, STAFF_BONUS_PER_HEAD, STARTING_CASH, STARTING_RATE, TAX_RATE,
  TIER_CAPACITY_MULT, businessOf, locationOf, priceLevelOf,
} from './config';
import { stepCompetitors } from './competitors';
import { maybeRollEvent } from './events';
import { newMacro, stepMacro } from './macro';
import { buildRoster, managerOf, reconcileRoster, ventureMonthly } from './ops';
import { rollApplicants, settleBarberMonth } from './barber';
import { BusinessId, GameState, LocationId, MonthRecord, SegmentSnapshot } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const SAVE_VERSION = 9;

export function newGame(business: BusinessId, location: LocationId, ownerName = '', avatar = { skin: 0, hair: 0, hairColor: 0 }): GameState {
  const biz = businessOf(business);
  const loc = locationOf(location);
  const startingStaff = Math.max(1, Math.round(biz.baseCapacityPerDay / biz.custPerStaffPerDay));
  return {
    roster: buildRoster(startingStaff),
    unattendedStreak: 0,
    energy: 100,
    ap: 0,
    condition: 90,
    activitiesDone: [],
    ventures: [],
    chairs: business === 'barber' ? 3 : 0,
    barbers: [],
    ownerChair: business === 'barber',
    chairApplicants: [],
    ownerName,
    avatar,
    business,
    location,
    month: 0,
    maxMonths: DEFAULT_MONTHS,
    cash: STARTING_CASH,
    loan: 0,
    interestRate: STARTING_RATE,
    reputation: 50,
    fatigue: 0,
    morale: 70,
    loyalty: 0,
    priceLevel: 'standard',
    marketingTier: 'none',
    staff: startingStaff,
    storeTier: 1,
    productLines: 0,
    macro: newMacro(),
    competitors: [],
    effects: [],
    rentCurrent: Math.round(loc.rent * biz.rentMult),
    leaseMonthsLeft: LEASE_TERM,
    quarterProfit: 0,
    inspectionDue: false,
    supplierDealMonths: 0,
    pendingChoice: null,
    cooldowns: {},
    choiceStats: { bold: 0, steady: 0, thrifty: 0 },
    renovationMonthsLeft: 0,
    plan: { demandMult: 1, cogsMult: 1, repDelta: 0, moraleDelta: 0, fatigueDelta: 0, loyaltyDelta: 0, decisionsMade: 0 },
    currentCards: [],
    completedCards: [],
    monthIntro: '',
    monthStory: [],
    activeMs: 0,
    lastPlayedAt: Date.now(),
    awayRecap: null,
    history: [],
    log: [`Opened a ${biz.name.toLowerCase()} in ${loc.name}. Good luck!`],
    gameOver: false,
    bankrupt: false,
    saveVersion: SAVE_VERSION,
  };
}

// ---- instant actions (taken during the planning phase) ----

export function launchProductLine(s: GameState): GameState {
  const biz = businessOf(s.business);
  const cost = Math.round(biz.productLineCost * s.macro.cpi);
  if (s.productLines >= MAX_PRODUCT_LINES || s.cash < cost) return s;
  return {
    ...s,
    cash: s.cash - cost,
    productLines: s.productLines + 1,
    fatigue: clamp(s.fatigue - 35, 0, 100),
    log: [...s.log, `🆕 Launched a new product line for $${cost.toLocaleString()}. Regulars are excited again.`],
  };
}

export function renovate(s: GameState): GameState {
  const biz = businessOf(s.business);
  const cost = Math.round(biz.renovationCost * s.macro.cpi);
  if (s.storeTier >= MAX_STORE_TIER || s.cash < cost || s.renovationMonthsLeft > 0) return s;
  // construction takes real time: pay now, endure the noise, expand in ~2 months
  return {
    ...s,
    cash: s.cash - cost,
    renovationMonthsLeft: 2,
    effects: [...s.effects, { id: 'construction', label: 'Renovation underway', monthsLeft: 2, demandMult: 0.95, cogsMult: 1, good: false }],
    log: [...s.log, `🔨 Renovation started — $${cost.toLocaleString()} down, roughly two months of dust ahead.`],
  };
}

export function borrow(s: GameState): GameState {
  if (s.loan + LOAN_STEP > LOAN_CAP) return s;
  return {
    ...s,
    loan: s.loan + LOAN_STEP,
    cash: s.cash + LOAN_STEP,
    log: [...s.log, `🏦 Borrowed $${LOAN_STEP.toLocaleString()} at ${s.interestRate.toFixed(1)}% APR.`],
  };
}

export function repay(s: GameState): GameState {
  const amount = Math.min(LOAN_STEP, s.loan);
  if (amount <= 0 || s.cash < amount) return s;
  return {
    ...s,
    loan: s.loan - amount,
    cash: s.cash - amount,
    log: [...s.log, `🏦 Repaid $${amount.toLocaleString()} of the loan.`],
  };
}

export function payStaffBonus(s: GameState): GameState {
  const cost = Math.round(s.staff * STAFF_BONUS_PER_HEAD * s.macro.cpi);
  if (s.cash < cost || s.morale >= 95) return s;
  return {
    ...s,
    cash: s.cash - cost,
    morale: clamp(s.morale + 14, 0, 100),
    log: [...s.log, `💝 Paid a $${cost.toLocaleString()} staff bonus. Morale is up.`],
  };
}

// ---- the monthly simulation ----

export interface MonthOutcome {
  state: GameState;
  record: MonthRecord;
  eventHeadline: string | null;
  eventGood: boolean;
  headlines: string[]; // macro + competitor news
}

export function endMonth(prev: GameState): MonthOutcome {
  const biz = businessOf(prev.business);
  const loc = locationOf(prev.location);
  const s: GameState = {
    ...prev,
    effects: prev.effects.map((e) => ({ ...e })),
    competitors: prev.competitors.map((c) => ({ ...c })),
    roster: prev.roster.map((m) => ({ ...m })),
    ventures: [...prev.ventures],
    log: [...prev.log],
  };
  const month = s.month + 1;
  const eventLabels: string[] = [];
  const headlines: string[] = [];

  // 0. The month is what you made of it: consume the decision plan
  const plan = s.plan;
  const unattended = plan.decisionsMade === 0;
  s.reputation = clamp(s.reputation + plan.repDelta, 0, 100);
  s.morale = clamp(s.morale + plan.moraleDelta, 0, 100);
  s.fatigue = clamp(s.fatigue + plan.fatigueDelta, 0, 100);
  s.loyalty = Math.max(0, s.loyalty + plan.loyaltyDelta);
  let planDemandMult = plan.demandMult;
  let planCogsMult = plan.cogsMult;
  if (unattended) {
    const mgr = managerOf(s);
    const streak = (s.unattendedStreak ?? 0) + 1;
    s.unattendedStreak = streak;
    if (mgr) {
      // the manager keeps the doors open — but standards slip a little
      // further every month the owner stays away
      const drift = Math.min(0.3, Math.max(0.005, 0.045 - mgr.skill * 0.008) + 0.03 * (streak - 1));
      planDemandMult *= 1 - drift;
      s.morale = clamp(s.morale - 1.5 * (streak - 1), 0, 100);
      s.condition = clamp(s.condition - 2 * (streak - 1), 0, 100);
      s.log.push(streak <= 1
        ? `🧭 ${mgr.name} ran the month without you. Steady hands.`
        : `📉 ${mgr.name} kept the lights on, but that's month ${streak} without you — corners are getting cut.`);
    } else {
      // nobody came to unlock the doors: the shop barely opened at all
      planDemandMult *= 0.22;
      planCogsMult *= 1.06;
      s.morale = clamp(s.morale - 9, 0, 100);
      s.log.push('🚪 Nobody came to open up. The shop sat dark most days — the bills didn\'t.');
    }
  } else {
    s.unattendedStreak = 0;
  }

  // 0b. The people: tenure ticks, personal morale drifts toward the room,
  // and the hard workers quietly get better at the job
  s.roster = reconcileRoster(s).map((m) => ({
    ...m,
    monthsEmployed: m.monthsEmployed + 1,
    morale: clamp(m.morale + (s.morale - m.morale) * 0.25, 0, 100),
    skill: m.hustle >= 65 && m.skill < 5 && Math.random() < 0.09 ? m.skill + 1 : m.skill,
  }));

  // 1. Macro economy turns first — everything else lives inside it
  const macroStep = stepMacro(s.macro);
  s.macro = macroStep.macro;
  if (macroStep.headline) {
    headlines.push(macroStep.headline);
    s.log.push(macroStep.headline);
  }
  const cpi = s.macro.cpi;

  // 2. Interest rate chases the macro anchor with noise
  s.interestRate = clamp(
    s.interestRate + (s.macro.rateAnchor - s.interestRate) * 0.18 + (Math.random() - 0.5) * 0.5,
    2, 14,
  );

  // 3. Health inspection resolves before anything else this month
  if (s.inspectionDue) {
    s.inspectionDue = false;
    const prevRecord = s.history[s.history.length - 1];
    const staffedWell = prevRecord ? s.staff >= Math.ceil(prevRecord.customers / 30 / biz.custPerStaffPerDay) : true;
    const passed = staffedWell && s.fatigue < 70 && s.morale >= 40;
    if (passed) {
      s.reputation = clamp(s.reputation + 4, 0, 100);
      const line = '📋 ✅ You passed the health inspection with flying colors. (+4 reputation)';
      headlines.push(line); s.log.push(line); eventLabels.push(line);
    } else {
      const fine = Math.round(2500 * cpi);
      s.cash -= fine;
      s.reputation = clamp(s.reputation - 10, 0, 100);
      s.effects.push({ id: 'failed-inspection', label: 'Failed inspection', monthsLeft: 2, demandMult: 0.85, cogsMult: 1, good: false });
      const line = `📋 ❌ You failed the health inspection: $${fine.toLocaleString()} fine and the report is public.`;
      headlines.push(line); s.log.push(line); eventLabels.push(line);
    }
  }

  // 4. Random event
  const ev = maybeRollEvent(s);
  let eventHeadline: string | null = null;
  let eventGood = true;
  if (ev) {
    eventHeadline = ev.headline;
    eventGood = ev.good;
    eventLabels.push(ev.headline);
    if (ev.effect) s.effects.push({ ...ev.effect });
    if (ev.repDelta) s.reputation = clamp(s.reputation + ev.repDelta, 0, 100);
    if (ev.cashDelta) s.cash += ev.cashDelta;
    if (ev.rateDelta) s.interestRate = clamp(s.interestRate + ev.rateDelta, 2, 14);
    if (ev.conditionDelta) s.condition = clamp(s.condition + ev.conditionDelta, 0, 100);
    if (ev.armsInspection) s.inspectionDue = true;
    if (ev.choice) s.pendingChoice = ev.choice;
    s.log.push(eventHeadline);
  }

  // 5. Competitor moves (they see last month's margin)
  const lastRec = s.history[s.history.length - 1];
  const recentMargin = lastRec && lastRec.revenue > 0 ? lastRec.profit / lastRec.revenue : 0.1;
  const comp = stepCompetitors(s, recentMargin);
  s.competitors = comp.competitors;
  comp.headlines.forEach((h) => { headlines.push(h); s.log.push(h); });

  // 6. Demand, segment by segment
  const traffic = loc.footTrafficPerDay * Math.pow(1 + loc.growthPerMonth, month);
  const calMonth = ((month - 1 + 2) % 12) + 1; // game starts in March
  const seasonality = 1 + biz.seasonalAmp * Math.cos((((calMonth - biz.peakMonth) % 12) / 12) * Math.PI * 2);
  const repMult = 0.6 + (s.reputation / 100) * 0.8;
  const priceMult = priceLevelOf(s.priceLevel).mult;
  const mkt = MARKETING_TIERS.find((m) => m.id === s.marketingTier)!;
  const eventMult = s.effects.reduce((m, e) => m * e.demandMult, 1);
  const productMult = 1 + s.productLines * 0.04;
  // a worn-down room quietly turns people away — nothing dramatic, just tired
  const conditionMult = s.condition >= 40 ? 1 : 1 - (40 - s.condition) * 0.004;

  let walkInPerDay = 0;
  const segmentDemand: Record<string, number> = {};
  for (const seg of SEGMENTS) {
    const base = traffic * loc.segmentMix[seg.id] * biz.capture * biz.affinity[seg.id];
    const priceResponse = Math.pow(priceMult, -seg.priceElasticity);
    const marketingResponse = 1 + mkt.boost * seg.marketingResponse;
    const fatiguePenalty = 1 - (s.fatigue / 100) * 0.5 * seg.fatigueSensitivity;
    const d = base * priceResponse * marketingResponse * Math.max(0.1, fatiguePenalty)
      * repMult * s.macro.confidence * eventMult * productMult * seasonality * planDemandMult * conditionMult;
    segmentDemand[seg.id] = d;
    walkInPerDay += d;
  }

  // competitors take their cut of walk-in demand; regulars stay loyal
  walkInPerDay *= comp.playerShare;

  // loyal regulars visit ~3x/month regardless of rivals, less when jaded
  const loyalPerDay = (s.loyalty * 3 / 30) * (1 - (s.fatigue / 100) * 0.3) * s.macro.confidence;
  const demandPerDay = walkInPerDay + loyalPerDay;

  // 7. Capacity + staffing + morale
  const capacity = biz.baseCapacityPerDay * TIER_CAPACITY_MULT[s.storeTier - 1];
  const served = Math.min(demandPerDay, capacity);
  const lostToCapacity = Math.max(0, demandPerDay - capacity);
  const staffNeeded = Math.max(1, Math.ceil(served / biz.custPerStaffPerDay));
  const staffRatio = s.staff / staffNeeded;

  if (staffRatio >= 1) {
    s.morale = clamp(s.morale + 2, 0, 100);
    s.reputation = clamp(s.reputation + 1, 0, 100);
  } else if (staffRatio >= 0.75) {
    s.morale = clamp(s.morale - 6, 0, 100);
    s.reputation = clamp(s.reputation - 1, 0, 100);
    s.log.push('⚠️ Slightly understaffed — the team is stretched.');
  } else {
    s.morale = clamp(s.morale - 12, 0, 100);
    s.reputation = clamp(s.reputation - 3, 0, 100);
    s.log.push('🚨 Badly understaffed — long waits and a burned-out team.');
  }
  // morale drives service quality; a person at the end of their rope quits
  const serviceMult = 0.75 + (s.morale / 100) * 0.3; // 0.75 – 1.05
  const unhappiest = s.roster.filter((m) => m.role !== 'manager').sort((a, b) => a.morale - b.morale)[0];
  if (unhappiest && unhappiest.morale < 32 && s.staff > 1 && Math.random() < 0.35) {
    s.staff -= 1;
    s.roster = s.roster.filter((m) => m.id !== unhappiest.id);
    const line = `👋 ${unhappiest.name} quit after ${unhappiest.monthsEmployed} months. You saw it coming — and didn't move.`;
    headlines.push(line); s.log.push(line);
  }

  // the place wears with use: a slammed month grinds equipment and floors
  const wear = 2 + (served / capacity) * 4;
  const prevCondition = s.condition;
  s.condition = clamp(s.condition - wear, 0, 100);
  if (prevCondition >= 40 && s.condition < 40) {
    s.log.push('🔩 The place is starting to look — and run — tired. Customers notice.');
  } else if (prevCondition >= 20 && s.condition < 20) {
    s.log.push('⚠️ Equipment is overdue for real maintenance. Something is going to give.');
  }
  if (lostToCapacity > capacity * 0.15) {
    s.reputation = clamp(s.reputation - 2, 0, 100);
    s.log.push('🚶 You turned away crowds at the door — the store is at capacity.');
  }

  const customersPerDay = served * serviceMult;
  const customers = Math.round(customersPerDay * 30);

  // segment snapshot (proportional attribution of served walk-ins)
  const walkInServed = Math.max(0, customersPerDay - loyalPerDay * serviceMult);
  const totalSegDemand = Object.values(segmentDemand).reduce((a, b) => a + b, 0) || 1;
  const segments: SegmentSnapshot[] = SEGMENTS.map((seg) => ({
    id: seg.id,
    customers: Math.round((segmentDemand[seg.id] / totalSegDemand) * walkInServed * 30),
  }));

  // 8. Loyalty stock: happy customers become regulars; fatigue & bad press churn them
  const satisfaction = (s.morale / 100) * 0.5 + (s.reputation / 100) * 0.5;
  let newRegulars = 0;
  for (const seg of SEGMENTS) {
    const segServed = (segmentDemand[seg.id] / totalSegDemand) * walkInServed * 30;
    newRegulars += segServed * seg.loyaltyRate * satisfaction;
  }
  const badPress = s.effects.some((e) => !e.good && e.demandMult < 1);
  const churnRate = 0.03 + (s.fatigue / 100) * 0.06 + (badPress ? 0.05 : 0);
  s.loyalty = clamp(s.loyalty + newRegulars - s.loyalty * churnRate, 0, loc.populationCap);

  // 9. Money — all nominal figures ride the CPI
  const ticket = biz.baseTicket * priceMult * (1 + s.productLines * 0.06) * cpi;
  const supplierDiscount = s.supplierDealMonths > 0 ? 0.92 : 1;
  const cogsMult = s.effects.reduce((m, e) => m * e.cogsMult, 1) * supplierDiscount * planCogsMult;
  const managerCount = s.roster.filter((m) => m.role === 'manager').length;

  // A barbershop is a landlord business: barbers rent your chairs and keep
  // what they cut, so your income is rent (plus your own chair), not margin
  // on sales — and nobody on that floor is on your payroll.
  const isBarber = s.business === 'barber';
  let revenue: number;
  let cogs: number;
  let wages: number;
  if (isBarber) {
    const settle = settleBarberMonth(s, customers);
    s.barbers = settle.barbers;
    settle.log.forEach((l) => { s.log.push(l); headlines.push(l); });
    revenue = settle.result.rentCollected + settle.result.ownerCuts;
    cogs = settle.result.ownerCuts * 0.08 * cogsMult;   // only your own chair uses product
    wages = Math.round(managerCount * MANAGER_WAGE_PREMIUM * biz.wagePerStaff * loc.wageMult * cpi);
    // barbers keep their own books; the shop's loyal stock is what they built
    s.loyalty = s.barbers.reduce((a, b) => a + b.clientele, 0);
    // working a chair yourself is real labour
    if (s.ownerChair) s.energy = clamp(s.energy - 10, 0, 100);
    // word gets around when there are chairs going spare
    const applicants = rollApplicants(s, Math.max(0, s.chairs - s.barbers.length) > 0 ? 1 + (Math.random() < 0.4 ? 1 : 0) : 0);
    s.chairApplicants = applicants;
    if (applicants.length) {
      s.log.push(`💈 ${applicants.length === 1 ? 'A barber is' : `${applicants.length} barbers are`} asking about a chair.`);
    }
  } else {
    revenue = customers * ticket;
    cogs = revenue * biz.cogsRate * cogsMult;
    wages = Math.round((s.staff + managerCount * MANAGER_WAGE_PREMIUM) * biz.wagePerStaff * loc.wageMult * cpi);
  }
  const overhead = Math.round(s.rentCurrent * 0.22 + (isBarber ? s.chairs * 90 : s.staff * 130) * cpi + revenue * 0.015);
  const marketingCost = Math.round(mkt.cost * cpi);
  const interestPaid = (s.loan * s.interestRate) / 100 / 12;

  // lease: rent is locked until renewal, then re-prices to market
  s.leaseMonthsLeft -= 1;
  if (s.leaseMonthsLeft <= 0) {
    const newRent = Math.round(loc.rent * biz.rentMult * cpi);
    const pct = ((newRent - s.rentCurrent) / s.rentCurrent) * 100;
    const line = `🏠 Lease renewed: rent is now $${newRent.toLocaleString()}/mo (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%).`;
    headlines.push(line); s.log.push(line);
    s.rentCurrent = newRent;
    s.leaseMonthsLeft = LEASE_TERM;
  }
  const rent = s.rentCurrent;

  const preTaxProfit = revenue - cogs - rent - wages - overhead - marketingCost - interestPaid;

  // quarterly taxes on positive accumulated profit
  s.quarterProfit += preTaxProfit;
  let taxes = 0;
  if (month % 3 === 0) {
    if (s.quarterProfit > 0) {
      taxes = s.quarterProfit * TAX_RATE;
      s.log.push(`🧾 Quarterly taxes: $${Math.round(taxes).toLocaleString()}.`);
    }
    s.quarterProfit = 0;
  }

  const profit = preTaxProfit - taxes;
  s.cash += profit;
  if (s.supplierDealMonths > 0) s.supplierDealMonths -= 1;

  // 9b. Ventures report in — the places running without you
  let ventureProfit = 0;
  for (const v of s.ventures) {
    const net = ventureMonthly(v, { ...s, month });
    ventureProfit += net;
    if (net !== 0) {
      s.log.push(net >= 0
        ? `🏪 ${v.name} sent up $${net.toLocaleString()} — ${v.managerName} is holding it down.`
        : `🏪 ${v.name} lost $${Math.abs(net).toLocaleString()} this month. ${v.managerName} is fighting the market.`);
    }
  }
  s.cash += ventureProfit;

  // 10. Fatigue creep
  const fatigueGain = s.marketingTier === 'campaign' ? 2.5 : 3.5;
  s.fatigue = clamp(s.fatigue + fatigueGain, 0, 100);

  // 10b. The owner's own tank: sleep helps a little, a manager helps more,
  // and running on empty starts to show in the work
  s.energy = clamp(s.energy + ENERGY_REGEN_PER_MONTH + (managerOf(s) ? 5 : 0), 0, 100);
  if (s.energy <= BURNOUT_THRESHOLD) {
    s.reputation = clamp(s.reputation - 2, 0, 100);
    s.morale = clamp(s.morale - 3, 0, 100);
    s.log.push('🥵 You\'re burned out — short with the team, sloppy with details. Take a real break.');
  }

  // 11. Reputation drifts gently toward 50
  s.reputation = clamp(s.reputation + (50 - s.reputation) * 0.02, 0, 100);

  // 12. Tick down lingering effects
  s.effects = s.effects
    .map((e) => ({ ...e, monthsLeft: e.monthsLeft - 1 }))
    .filter((e) => e.monthsLeft > 0);

  // 12b. Construction crews finish; scenario cooldowns tick down
  if (s.renovationMonthsLeft > 0) {
    s.renovationMonthsLeft -= 1;
    if (s.renovationMonthsLeft === 0) {
      s.storeTier = Math.min(MAX_STORE_TIER, s.storeTier + 1);
      s.reputation = clamp(s.reputation + 8, 0, 100);
      s.fatigue = clamp(s.fatigue - 15, 0, 100);
      const line = `🔨 The renovation is finished — welcome to your tier-${s.storeTier} space. The neighborhood noticed.`;
      headlines.push(line); s.log.push(line);
    }
  }
  const nextCooldowns: Record<string, number> = {};
  for (const [id, months] of Object.entries(s.cooldowns ?? {})) {
    if (months > 1) nextCooldowns[id] = months - 1;
  }
  s.cooldowns = nextCooldowns;

  // 13. Emergency borrowing / bankruptcy
  if (s.cash < 0 && s.loan < LOAN_CAP) {
    const need = Math.min(LOAN_CAP - s.loan, Math.ceil(-s.cash / 1000) * 1000);
    s.loan += need;
    s.cash += need;
    s.log.push(`🆘 Cash ran dry — the bank extended an emergency $${need.toLocaleString()} loan.`);
  }
  if (s.cash < BANKRUPTCY_FLOOR * cpi || (s.cash < 0 && s.loan >= LOAN_CAP)) {
    s.gameOver = true;
    s.bankrupt = true;
    s.log.push('💀 The bank called it. You are bankrupt.');
  }

  s.month = month;
  if (month >= s.maxMonths && !s.bankrupt) s.gameOver = true;

  const record: MonthRecord = {
    month,
    customers,
    loyalCustomers: Math.round(s.loyalty),
    lostToCapacity: Math.round(lostToCapacity * 30),
    revenue: Math.round(revenue),
    cogs: Math.round(cogs),
    rent,
    wages,
    overhead,
    marketingCost,
    interestPaid: Math.round(interestPaid),
    taxes: Math.round(taxes),
    profit: Math.round(profit),
    cash: Math.round(s.cash),
    reputation: Math.round(s.reputation),
    fatigue: Math.round(s.fatigue),
    morale: Math.round(s.morale),
    interestRate: s.interestRate,
    cpi,
    phase: s.macro.phase,
    marketShare: comp.playerShare,
    segments,
    eventLabels,
    ventureProfit: Math.round(ventureProfit),
  };
  s.history = [...s.history, record];

  // reset the story clock for the month ahead
  s.plan = { demandMult: 1, cogsMult: 1, repDelta: 0, moraleDelta: 0, fatigueDelta: 0, loyaltyDelta: 0, decisionsMade: 0 };
  s.currentCards = [];
  s.completedCards = [];
  s.monthIntro = '';
  s.monthStory = [];
  s.activeMs = 0;
  s.lastPlayedAt = Date.now();
  s.activitiesDone = [];

  return { state: s, record, eventHeadline, eventGood, headlines };
}

// ---- scoring ----

export interface FinalScore {
  valuation: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  summary: string;
}

export function scoreGame(s: GameState): FinalScore {
  if (s.bankrupt) {
    return { valuation: 0, grade: 'D', summary: 'The business went under. Every founder has a first failure — run it back.' };
  }
  const last3 = s.history.slice(-3);
  const avgProfit = last3.reduce((a, r) => a + r.profit, 0) / Math.max(1, last3.length);
  // buyers pay a lower multiple for a damaged brand; valuation in real (CPI-deflated) dollars
  const repMultiple = 0.5 + s.reputation / 100;
  const nominal = s.cash - s.loan + avgProfit * 12 * repMultiple + s.storeTier * 5000 + s.loyalty * 40;
  const valuation = Math.round(nominal / s.macro.cpi);
  const grade = valuation >= 700000 ? 'S' : valuation >= 400000 ? 'A' : valuation >= 160000 ? 'B' : valuation >= 60000 ? 'C' : 'D';
  const summaries: Record<string, string> = {
    S: 'A local legend. Investors are calling — franchise material.',
    A: 'A thriving business with real momentum. Well played.',
    B: 'A solid, profitable operation. Room to grow.',
    C: 'You survived — barely profitable. Study your worst months.',
    D: 'Still standing, but the numbers are rough. Rethink the fundamentals.',
  };
  return { valuation, grade, summary: summaries[grade] };
}
