import { businessOf, locationOf, priceLevelOf } from './config';
import type { GameState } from './types';
import { buildSystem, buildUser, extractJson, validateReply } from './mentorCore';

/**
 * The AI mentor, client side.
 *
 * mentorSnapshot() turns the live game into a small summary (never the whole
 * GameState: history and log grow forever, which costs money and adds noise).
 * askMentor() sends it to Claude and returns a validated reply, or null on ANY
 * failure, so the game never depends on the model.
 *
 * Two ways to reach Claude:
 *  - a published claude.ai page asks Claude directly (no server, no key)
 *  - anywhere else it calls this repo's server at POST /mentor
 */

export interface MentorSnapshot {
  business: string;
  location: string;
  month: number;
  maxMonths: number;
  cash: number;
  loan: number;
  interestRate: number;
  reputation: number;
  staffMorale: number;
  customerFatigue: number;
  ownerEnergy: number;
  ap: number;
  premisesCondition: number;
  price: string;
  marketing: string;
  staff: number;
  storeTier: number;
  economy: string;
  rivals: string[];
  activeEffects: string[];
  cardsWaiting: number;
  lastMonth?: {
    revenue: number; cogs: number; rent: number; wages: number; overhead: number;
    marketing: number; interest: number; taxes: number; profit: number; customers: number; lostToCapacity: number;
  };
}

export function mentorSnapshot(s: GameState): MentorSnapshot {
  const r = s.history[s.history.length - 1];
  const n = (v: number) => Math.round(v);
  return {
    business: businessOf(s.business).name,
    location: locationOf(s.location).name,
    month: s.month + 1,
    maxMonths: s.maxMonths,
    cash: n(s.cash),
    loan: n(s.loan),
    interestRate: Math.round(s.interestRate * 10) / 10,
    reputation: n(s.reputation),
    staffMorale: n(s.morale),
    customerFatigue: n(s.fatigue),
    ownerEnergy: n(s.energy),
    ap: s.ap,
    premisesCondition: n(s.condition),
    price: priceLevelOf(s.priceLevel).name,
    marketing: s.marketingTier,
    staff: s.staff,
    storeTier: s.storeTier,
    economy: `${s.macro.phase}, inflation ${s.macro.inflationYoY.toFixed(1)}%/yr`,
    rivals: s.competitors.map((c) => `${c.name} (${c.stance})`),
    activeEffects: s.effects.map((e) => `${e.label} (${e.monthsLeft}mo)`),
    cardsWaiting: s.currentCards.length - s.completedCards.length,
    ...(r ? {
      lastMonth: {
        revenue: n(r.revenue), cogs: n(r.cogs), rent: n(r.rent), wages: n(r.wages), overhead: n(r.overhead),
        marketing: n(r.marketingCost), interest: n(r.interestPaid), taxes: n(r.taxes), profit: n(r.profit),
        customers: n(r.customers), lostToCapacity: n(r.lostToCapacity),
      },
    } : {}),
  };
}

export type MentorMode = 'coach' | 'advise' | 'debrief' | 'ask';

export interface MentorRequest {
  mode: MentorMode;
  snapshot: MentorSnapshot;
  /** coach mode: what the current tutorial step teaches */
  stepGoal?: string;
  /** ask mode: the player's own question */
  question?: string;
}

export interface MentorReply {
  message: string;
  recommendations?: { action: string; reason: string; risk: 'low' | 'medium' | 'high' }[];
}

/**
 * In a published claude.ai page there is no server and no API key: the page asks
 * Claude through the `sample` capability, on the viewer's own account. The viewer
 * is asked to allow it on the first call, so only call this from a tap.
 */
export async function askMentorViaClaude(req: MentorRequest): Promise<MentorReply | null> {
  try {
    const c = (globalThis as unknown as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
    const sample = c?.use
      ? ((await c.use('sample')) as null | ((input: string, opts?: Record<string, unknown>) => Promise<{ text: string }>))
      : null;
    if (!sample) return null;
    const core = { ...req, snapshot: req.snapshot as unknown as Record<string, unknown> };
    const input = `${buildSystem(req.mode)}\n\n${buildUser(core)}`;
    const { text } = await sample(input, { modelTier: req.mode === 'advise' ? 'default' : 'quick', cache: false });
    return validateReply(extractJson(text), req.mode);
  } catch {
    return null;
  }
}

/**
 * baseUrl '' = ask Claude directly (published claude.ai page).
 * A URL = this repo's server (server/index.mjs), which holds the API key.
 * Returns null on ANY failure (offline, timeout, bad reply).
 */
export async function askMentor(baseUrl: string, req: MentorRequest, timeoutMs = 20000): Promise<MentorReply | null> {
  if (!baseUrl) return askMentorViaClaude(req);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/mentor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return validateReply(data, req.mode);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
