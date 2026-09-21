import { endMonth } from './engine';
import { awayRecap } from './narration';
import { GameState } from './types';

/**
 * The game clock. A month closes when the owner has made 4 decisions or
 * played 20 active minutes. Away from the game, the world keeps turning:
 * each full real day is a month on autopilot, capped at 3 per return so a
 * vacation can't kill a run outright.
 */

export const ACTIVE_MS_PER_MONTH = 20 * 60 * 1000;
export const MS_PER_AWAY_MONTH = 24 * 60 * 60 * 1000;
export const MAX_AWAY_MONTHS = 3;

export interface CatchUp {
  state: GameState;
  monthsPassed: number;
}

/** Simulate the months that passed while the player was away. */
export function catchUpOfflineTime(s: GameState, now = Date.now()): CatchUp {
  if (s.gameOver) return { state: s, monthsPassed: 0 };
  const away = now - (s.lastPlayedAt || now);
  const months = Math.min(
    MAX_AWAY_MONTHS,
    Math.floor(away / MS_PER_AWAY_MONTH),
    s.maxMonths - s.month,
  );
  if (months <= 0) return { state: s, monthsPassed: 0 };

  const cashBefore = s.cash;
  let state = s;
  for (let i = 0; i < months && !state.gameOver; i++) {
    // unattended months: the empty plan triggers the engine's autopilot penalty
    state = endMonth(state).state;
    // pending event decisions expire unanswered while you're away
    if (state.pendingChoice) state = { ...state, pendingChoice: null };
  }
  state = {
    ...state,
    lastPlayedAt: now,
    awayRecap: awayRecap(months, cashBefore, state.cash, state.bankrupt),
  };
  return { state, monthsPassed: months };
}
