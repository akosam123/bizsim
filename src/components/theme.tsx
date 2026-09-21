import React, { createContext, useContext } from 'react';

/**
 * The color system. Two full palettes — the moody dark chrome the game
 * shipped with, and a clean daylight theme — behind one context. Components
 * build their StyleSheets through useThemedStyles, which caches one sheet
 * per (component, mode) so switching is instant and allocation-free.
 *
 * Overlays that sit ON TOP OF ART (name chips, hotspot pills, scrims) stay
 * hardcoded dark in their components — art needs a dark scrim in any theme.
 */

export type ThemeMode = 'dark' | 'light';

export interface Palette {
  mode: ThemeMode;
  // core
  bg: string; card: string; cardAlt: string; border: string;
  text: string; dim: string;
  accent: string; danger: string; warn: string; blue: string;
  // chrome
  hudBg: string; hudBorder: string;     // top bar
  btnBg: string; btnBorder: string;     // icon buttons
  panelBg: string;                      // vitals pills, activity buttons
  track: string;                        // bar backgrounds
  slateBg: string; slateText: string;   // narrator slates & toasts
  apBg: string; apBorder: string; apText: string;
  icon: string;                         // default chrome glyph color
  scrim: string;                        // modal backdrop
  shadowOpacity: number;
  statusBar: 'light' | 'dark';
}

export const DARK: Palette = {
  mode: 'dark',
  bg: '#12141d', card: '#1c2030', cardAlt: '#242940', border: '#33384a',
  text: '#e8ebf5', dim: '#8b93ad',
  accent: '#5ac47f', danger: '#e05b4b', warn: '#e8c86a', blue: '#3d9be9',
  hudBg: '#161927f2', hudBorder: '#2e3450',
  btnBg: '#222842', btnBorder: '#343c60',
  panelBg: '#161927f2',
  track: '#0c0e16',
  slateBg: '#141724f8', slateText: '#d9dcec',
  apBg: '#2a2415', apBorder: '#4d4020', apText: '#e8c86a',
  icon: '#aeb9dd',
  scrim: '#000b',
  shadowOpacity: 0.4,
  statusBar: 'light',
};

export const LIGHT: Palette = {
  mode: 'light',
  bg: '#eef0f6', card: '#ffffff', cardAlt: '#e7eaf3', border: '#d3d8e5',
  text: '#232838', dim: '#5f6880',
  accent: '#2f9e5f', danger: '#d64937', warn: '#a97e14', blue: '#2f7fce',
  hudBg: '#fffffff5', hudBorder: '#d3d8e5',
  btnBg: '#eef0f8', btnBorder: '#d3d8e5',
  panelBg: '#fffffff2',
  track: '#dde1ec',
  slateBg: '#fdfaf1fa', slateText: '#4a4438',
  apBg: '#f7ecc9', apBorder: '#ddc684', apText: '#7c6211',
  icon: '#5f6880',
  scrim: '#0008',
  shadowOpacity: 0.12,
  statusBar: 'dark',
};

const ThemeCtx = createContext<Palette>(DARK);
export const ThemeProvider = ThemeCtx.Provider;

export function useTheme(): Palette {
  return useContext(ThemeCtx);
}

// one built sheet per (factory, mode) — cheap to switch, nothing rebuilt on re-render
const sheetCache = new WeakMap<object, Partial<Record<ThemeMode, unknown>>>();

export function useThemedStyles<T>(make: (C: Palette) => T): T {
  const C = useTheme();
  let byMode = sheetCache.get(make as object);
  if (!byMode) { byMode = {}; sheetCache.set(make as object, byMode); }
  if (!byMode[C.mode]) byMode[C.mode] = make(C);
  return byMode[C.mode] as T;
}
