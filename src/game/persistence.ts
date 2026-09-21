import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_VERSION } from './engine';
import { buildRoster } from './ops';
import { GameState } from './types';

const SAVE_KEY = 'bizsim.save';
const PREFS_KEY = 'bizsim.prefs';

export async function saveGame(state: GameState): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // saving is best-effort; never break the game over storage
  }
}

export async function loadGame(): Promise<GameState | null> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    let state = JSON.parse(raw) as GameState;
    if (state.gameOver) return null;
    // v7 → v8: the ops layer arrived (roster, energy, AP, wear, ventures)
    if (state.saveVersion === 7) {
      state = {
        ...state,
        roster: buildRoster(state.staff, Math.max(0, state.month - 1)),
        energy: 85,
        ap: 2,
        condition: Math.max(45, 90 - state.month * 3),
        activitiesDone: [],
        ventures: [],
        chairs: state.business === 'barber' ? 3 : 0,
        barbers: [],
        ownerChair: state.business === 'barber',
        chairApplicants: [],
        saveVersion: SAVE_VERSION,
      };
    }
    if (state.saveVersion === 8) {
      state = {
        ...state,
        chairs: state.business === 'barber' ? 3 : 0,
        barbers: [],
        ownerChair: state.business === 'barber',
        chairApplicants: [],
        saveVersion: SAVE_VERSION,
      };
    }
    if (state.saveVersion !== SAVE_VERSION) return null;
    // additive fields default in quietly for older v8 saves
    if (typeof state.unattendedStreak !== 'number') state = { ...state, unattendedStreak: 0 };
    return state;
  } catch {
    return null;
  }
}

export async function clearSave(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SAVE_KEY);
  } catch {}
}

export interface Prefs {
  soundOn: boolean;
  aiKey?: string; // Anthropic API key for AI-directed scenarios (stored on-device only)
  theme?: 'dark' | 'light';
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { soundOn: true, ...JSON.parse(raw) } : { soundOn: true };
  } catch {
    return { soundOn: true };
  }
}

export async function savePrefs(p: Prefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}
