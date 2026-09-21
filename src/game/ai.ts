import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { CAST } from './cast';
import { businessOf, locationOf, priceLevelOf } from './config';
import { monthName } from './narration';
import { DecisionCard, GameState } from './types';

/**
 * The AI scenario director. Once the player adds an Anthropic API key
 * (Settings ⚙), one scene per month is written live by Claude — grounded
 * in the actual books, aware of how this player tends to decide, and
 * built to challenge that pattern with realistic business tradeoffs.
 * Everything is validated and clamped before it touches the simulation;
 * if anything is off, the handcrafted deck plays instead.
 */

const CardSchema = z.object({
  title: z.string(),
  speaker: z.enum(['manager', 'landlord', 'banker', 'supplier', 'inspector', 'regular', 'accountant', 'contractor', 'rival', 'influencer', 'neighbor']),
  mood: z.enum(['neutral', 'happy', 'worried', 'stern']),
  venue: z.enum(['street', 'inside', 'back', 'office']),
  lines: z.array(z.string()).min(2).max(3),
  options: z.array(z.object({
    label: z.string(),
    hint: z.string(),
    tone: z.enum(['bold', 'steady', 'thrifty']),
    cost: z.number(),          // dollars now; negative = income
    demandMult: z.number(),    // this month's demand multiplier
    cogsMult: z.number(),      // this month's goods-cost multiplier
    repDelta: z.number(),
    moraleDelta: z.number(),
    fatigueDelta: z.number(),
    loyaltyDelta: z.number(),
    lingeringLabel: z.string(),      // '' for none
    lingeringMonths: z.number(),     // 0 for none
    lingeringDemandMult: z.number(), // 1 for none
    lingeringCogsMult: z.number(),   // 1 for none
    result: z.string(),
    resultMood: z.enum(['neutral', 'happy', 'worried', 'stern']),
  })).min(2).max(3),
});

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));

/** What kind of owner is this? Feed the pattern to the director. */
function playerProfile(s: GameState): string {
  const { bold, steady, thrifty } = s.choiceStats;
  const total = bold + steady + thrifty || 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  const dominant = bold >= steady && bold >= thrifty ? 'bold (spends and swings big)'
    : thrifty >= steady ? 'thrifty (avoids spending, often ignores problems)'
    : 'steady (measured, takes the sensible fix)';
  const recent = s.history.slice(-3);
  const profits = recent.map((r) => `$${r.profit.toLocaleString()}`).join(', ') || 'no months yet';
  return [
    `Decision pattern: bold ${pct(bold)}%, steady ${pct(steady)}%, thrifty ${pct(thrifty)}% — dominant style: ${dominant}.`,
    `Recent monthly profits: ${profits}.`,
    `Design the dilemma to genuinely test this player's dominant style — if they lean thrifty, make the cheap path carry a real hidden cost; if bold, make the flashy option overextend them; if steady, present a fork where the middle road quietly loses to a decisive call.`,
  ].join('\n');
}

function stateBrief(s: GameState): string {
  const biz = businessOf(s.business);
  const loc = locationOf(s.location);
  const rivals = s.competitors.map((c) => `${c.name} (${c.stance}, ${c.monthsActive}mo)`).join('; ') || 'none';
  const effects = s.effects.map((e) => `${e.label} (${e.monthsLeft}mo)`).join('; ') || 'none';
  const recentScenes = s.currentCards.map((c) => c.id).join(', ') || 'none';
  return [
    `Business: ${biz.name} in ${loc.name} (${s.location} density). Month: ${monthName(s.month + 1)}, game month ${s.month + 1}/${s.maxMonths}.`,
    `Cash $${Math.round(s.cash).toLocaleString()}, debt $${s.loan.toLocaleString()} at ${s.interestRate.toFixed(1)}%, reputation ${Math.round(s.reputation)}/100, staff morale ${Math.round(s.morale)}/100, customer fatigue ${Math.round(s.fatigue)}/100, ${Math.round(s.loyalty)} regulars.`,
    `Pricing: ${priceLevelOf(s.priceLevel).name}. Marketing: ${s.marketingTier}. Staff: ${s.staff}. Store tier ${s.storeTier}/3.`,
    `Economy: ${s.macro.phase}, inflation ${s.macro.inflationYoY.toFixed(1)}%/yr. Rivals: ${rivals}. Active effects: ${effects}.`,
    `Scenes already queued this month (do not duplicate their topics): ${recentScenes}.`,
  ].join('\n');
}

const SYSTEM = `You write one scene for a business-simulation game. The player owns a small business; recurring characters bring them decisions. Your scene must feel like a real small-business dilemma — specific, grounded, with second-order consequences — not a generic video-game event.

CAST (pick the right person for the topic):
${Object.values(CAST).map((ch) => `- ${ch.id}: ${ch.name}, ${ch.role}`).join('\n')}

HARD RULES:
- Stay true to the business type. A barbershop sells services (cuts, shaves, product retail) — nothing spoils, nobody tastes anything. A convenience store sells packaged goods. Restaurants/cafés/bakeries handle food.
- lines: 2-3 dialogue beats spoken BY the chosen character in their voice, each under 220 characters. First person, addressed to "boss"/"dear"/etc. per their persona.
- options: 2-3 choices with REAL tradeoffs. No strictly-best option. Money amounts belong in the label, e.g. "Fund the pilot ($1,200)".
- Numeric bounds (values outside these will be clamped): cost -2500..3000 (negative = the player RECEIVES money), demandMult 0.88..1.12, cogsMult 0.92..1.08, repDelta -6..6, moraleDelta -10..10, fatigueDelta -8..8, loyaltyDelta -15..15, lingeringMonths 0..4, lingeringDemandMult 0.9..1.1, lingeringCogsMult 0.94..1.06.
- result: the character's spoken reaction to that pick (1-2 sentences, in voice).
- Reference the actual numbers and names from the state brief (rivals by name, real cash pressure, the season). Complexity beats melodrama: think supplier terms, labor tradeoffs, cash-flow timing, local politics, capacity math.`;

export async function generateAiCard(s: GameState, apiKey: string): Promise<DecisionCard | null> {
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 4096,
      output_config: { format: zodOutputFormat(CardSchema), effort: 'medium' },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `STATE BRIEF\n${stateBrief(s)}\n\nPLAYER PROFILE\n${playerProfile(s)}\n\nWrite the scene.`,
      }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) return null;
    const raw = response.parsed_output;

    const cpi = s.macro.cpi;
    const card: DecisionCard = {
      id: `ai-${s.month + 1}`,
      aiGenerated: true,
      title: raw.title.slice(0, 60),
      speaker: raw.speaker,
      mood: raw.mood,
      venue: raw.venue,
      lines: raw.lines.map((l) => l.slice(0, 260)),
      options: raw.options.map((o) => {
        const months = Math.round(clamp(o.lingeringMonths, 0, 4));
        const lingering = months > 0 && o.lingeringLabel
          ? {
            id: `ai-fx-${s.month + 1}`,
            label: o.lingeringLabel.slice(0, 30),
            monthsLeft: months,
            demandMult: clamp(o.lingeringDemandMult, 0.9, 1.1),
            cogsMult: clamp(o.lingeringCogsMult, 0.94, 1.06),
            good: o.lingeringDemandMult >= 1 && o.lingeringCogsMult <= 1,
          }
          : undefined;
        return {
          label: o.label.slice(0, 70),
          hint: o.hint.slice(0, 60),
          tone: o.tone,
          cost: Math.round(clamp(o.cost, -2500, 3000) * cpi),
          effects: {
            demandMult: clamp(o.demandMult, 0.88, 1.12),
            cogsMult: clamp(o.cogsMult, 0.92, 1.08),
            repDelta: clamp(o.repDelta, -6, 6),
            moraleDelta: clamp(o.moraleDelta, -10, 10),
            fatigueDelta: clamp(o.fatigueDelta, -8, 8),
            loyaltyDelta: clamp(o.loyaltyDelta, -15, 15),
            ...(lingering ? { lingering } : {}),
          },
          result: o.result.slice(0, 300),
          resultMood: o.resultMood,
        };
      }),
    };
    return card;
  } catch {
    // network, auth, parse — the handcrafted deck plays instead
    return null;
  }
}
