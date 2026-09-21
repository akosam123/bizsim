import { EconomyPhase, Macro } from './types';

/**
 * The macro economy is a Markov chain over four phases. Each phase pulls
 * consumer confidence, monthly inflation, and the central-bank rate anchor
 * toward its own regime; the game's interest rate then chases the anchor.
 */

interface PhaseParams {
  confidence: number;       // demand multiplier target
  inflationMonthly: number; // CPI growth per month
  rateAnchor: number;       // % the interest rate drifts toward
  label: string;
  emoji: string;
}

export const PHASE_PARAMS: Record<EconomyPhase, PhaseParams> = {
  boom:      { confidence: 1.12, inflationMonthly: 0.006, rateAnchor: 8.0, label: 'Boom',      emoji: '🔥' },
  steady:    { confidence: 1.0,  inflationMonthly: 0.0025, rateAnchor: 5.5, label: 'Steady',   emoji: '⚖️' },
  downturn:  { confidence: 0.92, inflationMonthly: 0.0012, rateAnchor: 4.0, label: 'Downturn', emoji: '🌧️' },
  recession: { confidence: 0.82, inflationMonthly: 0.0003, rateAnchor: 2.8, label: 'Recession', emoji: '🧊' },
};

// row = current phase; probabilities of moving to [boom, steady, downturn, recession]
const TRANSITIONS: Record<EconomyPhase, [number, number, number, number]> = {
  boom:      [0.80, 0.17, 0.03, 0.00],
  steady:    [0.07, 0.84, 0.09, 0.00],
  downturn:  [0.02, 0.16, 0.68, 0.14],
  recession: [0.00, 0.05, 0.22, 0.73],
};

const PHASES: EconomyPhase[] = ['boom', 'steady', 'downturn', 'recession'];

export function newMacro(): Macro {
  return {
    phase: 'steady',
    monthsInPhase: 0,
    cpi: 1.0,
    inflationYoY: 3.0,
    confidence: 1.0,
    rateAnchor: PHASE_PARAMS.steady.rateAnchor,
  };
}

export interface MacroStep {
  macro: Macro;
  phaseChanged: boolean;
  headline: string | null;
}

const PHASE_HEADLINES: Record<EconomyPhase, string> = {
  boom: '📰 The economy is booming — consumers are spending freely.',
  steady: '📰 The economy has settled into a steady rhythm.',
  downturn: '📰 Economic slowdown: shoppers are tightening their belts.',
  recession: '📰 Recession declared. Expect lean months ahead.',
};

export function stepMacro(m: Macro): MacroStep {
  const probs = TRANSITIONS[m.phase];
  // phases get "tired": after 8+ months, nudge probability mass off the diagonal
  const fatigueShift = Math.min(0.15, Math.max(0, (m.monthsInPhase - 8) * 0.02));
  let r = Math.random() * (1 - fatigueShift * 0);
  let nextPhase: EconomyPhase = m.phase;
  const idx = PHASES.indexOf(m.phase);
  const adjusted = probs.map((p, i) => (i === idx ? p - fatigueShift : p + fatigueShift / 3));
  const total = adjusted.reduce((a, b) => a + b, 0);
  r = Math.random() * total;
  for (let i = 0; i < PHASES.length; i++) {
    r -= adjusted[i];
    if (r <= 0) { nextPhase = PHASES[i]; break; }
  }

  const phaseChanged = nextPhase !== m.phase;
  const params = PHASE_PARAMS[nextPhase];
  const inflation = params.inflationMonthly * (0.7 + Math.random() * 0.6);
  const cpi = m.cpi * (1 + inflation);
  // confidence moves partway toward the regime target each month (sticky mood)
  const confidence = m.confidence + (params.confidence - m.confidence) * 0.35;

  return {
    macro: {
      phase: nextPhase,
      monthsInPhase: phaseChanged ? 1 : m.monthsInPhase + 1,
      cpi,
      inflationYoY: ((Math.pow(1 + inflation, 12) - 1) * 100),
      confidence,
      rateAnchor: params.rateAnchor,
    },
    phaseChanged,
    headline: phaseChanged ? PHASE_HEADLINES[nextPhase] : null,
  };
}

export function phaseDisplay(phase: EconomyPhase) {
  return PHASE_PARAMS[phase];
}
