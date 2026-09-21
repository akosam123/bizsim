/** Tiny color math for the lighting system: mix a hex color toward white
 * (amt > 0) or black (amt < 0). Used to build gradient stops per character. */
export function shade(hex: string, amt: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const target = amt > 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amt));
  const mix = (c: number) => Math.round(c + (target - c) * t);
  const to2 = (c: number) => c.toString(16).padStart(2, '0');
  return `#${to2(mix(r))}${to2(mix(g))}${to2(mix(b))}`;
}

/** Stable gradient id per color (SVG ids are global on web; identical
 * colors produce identical defs, so collisions are harmless). */
export function gradId(prefix: string, color: string): string {
  return `${prefix}${color.replace('#', '')}`;
}
