import { businessOf, locationOf } from './config';
import { GameState, MonthRecord } from './types';

/**
 * Second-person narration. The player is the owner; the game talks to them
 * the way the best sim stories do — specific, grounded, a little wry.
 */

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** The story starts in March — a spring opening. */
export function calendarMonth(gameMonth: number): number {
  return ((gameMonth - 1 + 2) % 12) + 1; // 1-12
}
export function monthName(gameMonth: number): string {
  return MONTH_NAMES[calendarMonth(gameMonth) - 1];
}
export function yearOf(gameMonth: number): number {
  return 1 + Math.floor((gameMonth - 1 + 2) / 12);
}

const SEASON_LINES: Record<string, string[]> = {
  winter: [
    'Cold rain streaks the windows and everyone comes in with their shoulders up.',
    'The heater hums all day. Daylight is gone by five.',
    'Snow slush tracks across the floor no matter how often you mop.',
  ],
  spring: [
    'The street trees are budding and foot traffic is waking up with them.',
    'First warm week of the season — people are lingering outside again.',
    'Pollen dusts the windowsills. The morning light comes earlier now.',
  ],
  summer: [
    'The afternoons are long and hot, and the sidewalk is busy late.',
    'Summer crowds drift past in no hurry at all.',
    'The AC strains through the afternoon rush.',
  ],
  fall: [
    'Leaves pile against the doorway. The morning air has a bite to it.',
    'The after-work rush comes earlier as the days shorten.',
    'Sweater weather — your regulars linger a little longer inside.',
  ],
};

function seasonOf(cal: number): string {
  if (cal === 12 || cal <= 2) return 'winter';
  if (cal <= 5) return 'spring';
  if (cal <= 8) return 'summer';
  return 'fall';
}

const PHASE_LINES: Record<string, string[]> = {
  boom: [
    'The papers say the economy is roaring, and you can feel it in the till.',
    'Money is loose right now — people are treating themselves.',
  ],
  steady: [
    'Business news is quiet. Steady as she goes.',
    'No headlines, no drama — the kind of month you can plan around.',
  ],
  downturn: [
    'Customers are counting their change again. You can feel belts tightening.',
    'The slowdown is in the air — smaller orders, more hesitation.',
  ],
  recession: [
    'The recession is the only thing anyone talks about. Every sale feels earned.',
    'Times are hard out there. People still come — but carefully.',
  ],
};

const STATE_HOOKS = {
  highFatigue: [
    'You catch a regular stifling a yawn at the menu. Same old, same old.',
    "The concept is feeling stale — you've seen three regulars less often lately.",
  ],
  lowMorale: [
    'The team is quiet this week. Not the good kind of quiet.',
    'Someone left the break-room door shut all shift. Morale needs attention.',
  ],
  highRep: [
    'A stranger tells you their friend recommended this place. Word is out.',
    'Your name is starting to mean something around here.',
  ],
  lowCash: [
    'You check the account before opening. The number stares back, unimpressed.',
    'Cash is tight enough that you do the math twice on every order.',
  ],
  rivals: [
    'On your walk in, you pass the competition. Their line is not short.',
    'A rival flyer is taped to the lamppost outside. Bold of them.',
  ],
};

export function monthOpen(s: GameState): string {
  const cal = calendarMonth(s.month + 1);
  const season = seasonOf(cal);
  const name = s.ownerName ? `, ${s.ownerName}` : '';
  const opener = `${monthName(s.month + 1)}, year ${yearOf(s.month + 1)}. You unlock the door of your ${businessOf(s.business).name.toLowerCase()} in ${locationOf(s.location).name}${name}.`;
  const lines: string[] = [opener, pick(SEASON_LINES[season]), pick(PHASE_LINES[s.macro.phase])];
  if (s.fatigue > 55) lines.push(pick(STATE_HOOKS.highFatigue));
  else if (s.morale < 45) lines.push(pick(STATE_HOOKS.lowMorale));
  else if (s.cash < 6000) lines.push(pick(STATE_HOOKS.lowCash));
  else if (s.competitors.length >= 2) lines.push(pick(STATE_HOOKS.rivals));
  else if (s.reputation > 70) lines.push(pick(STATE_HOOKS.highRep));
  return lines.join(' ');
}

export function monthRecap(r: MonthRecord, s: GameState): string {
  const profitLine =
    r.profit >= 4000 ? pick([
      `A genuinely great month — ${fmtMoney(r.profit)} to the good.`,
      `You count the month out at +${fmtMoney(r.profit)}. This is what it's supposed to feel like.`,
    ]) :
    r.profit >= 500 ? pick([
      `The month closes ${fmtMoney(r.profit)} in the black. Not glamorous, but forward.`,
      `A modest +${fmtMoney(r.profit)}. Rent is paid and the lights stay on.`,
    ]) :
    r.profit >= -500 ? pick([
      'You basically broke even. A month of running to stand still.',
      'The ledger lands at almost exactly zero. All that work, a wash.',
    ]) : pick([
      `The month bleeds ${fmtMoney(-r.profit)}. You feel every dollar of it.`,
      `Down ${fmtMoney(-r.profit)}. You sit with the books a long time after close.`,
    ]);
  const extras: string[] = [];
  if (r.lostToCapacity > r.customers * 0.12) extras.push('You turned people away at the door — the place simply cannot hold them.');
  if (r.taxes > 0) extras.push(`The quarterly tax bill took ${fmtMoney(r.taxes)}.`);
  if (s.loyalty > 20 && r.loyalCustomers > 0) extras.push(`${r.loyalCustomers} regulars now count this place as theirs.`);
  return [profitLine, ...extras].join(' ');
}

export function awayRecap(monthsPassed: number, cashBefore: number, cashAfter: number, bankrupt: boolean): string {
  const delta = cashAfter - cashBefore;
  const deltaLine = bankrupt
    ? 'It was not enough. The bank made its call while you were gone.'
    : delta >= 0
      ? `The books moved ${fmtMoney(delta)} in your favor.`
      : `Running on autopilot cost you ${fmtMoney(-delta)}.`;
  return `You were away, and the world did not wait: ${monthsPassed} month${monthsPassed > 1 ? 's' : ''} passed. ` +
    `Your team kept the doors open without you — decisions deferred, opportunities missed. ${deltaLine}`;
}

function fmtMoney(v: number): string {
  return `$${Math.round(Math.abs(v)).toLocaleString()}`;
}
