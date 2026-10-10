// DOM overlays: HUD, the month's to-do list, paper dialogue cards, panels.
import type { GameState, MonthRecord, DecisionCard } from '../../src/game/types';
import { BUSINESSES, LOCATIONS, MARKETING_TIERS, PRICE_LEVELS, LOAN_CAP, LOAN_STEP, LOAN_AP, ADS_AP, TIER_CAPACITY_MULT } from '../../src/game/config';
import { CAST } from '../../src/game/cast';
import { monthName, yearOf } from '../../src/game/narration';
import { phaseDisplay } from '../../src/game/macro';
import { STANCE_DESC } from '../../src/game/competitors';
import { currentMenu, formatPrice } from '../../src/game/menu';
import type { MonthOutcome, FinalScore } from '../../src/game/engine';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const money = (n: number) => {
  const r = Math.round(n);
  return (r < 0 ? '−$' : '$') + Math.abs(r).toLocaleString('en-US');
};
export const signed = (n: number) => (n >= 0 ? '+' : '') + money(n).replace('−', '−');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
// strip leading emoji from engine log lines; the UI carries its own markers
export const clean = (s: string) => s.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();

// ---------------- HUD ----------------
export function renderHud(s: GameState) {
  $('monthOf').textContent = `Month ${Math.min(s.month + 1, s.maxMonths)} of ${s.maxMonths}`;
  $('date').textContent = `${monthName(s.month + 1)} · Yr ${yearOf(s.month + 1)}`;
  const c = $('cash');
  c.textContent = money(s.cash);
  c.classList.toggle('neg', s.cash < 0);
  $('rep').textContent = String(Math.round(s.reputation));
  const e = $('energy');
  e.style.width = `${Math.max(0, Math.min(100, s.energy))}%`;
  e.style.background = s.energy < 25 ? 'var(--loss)' : s.energy < 50 ? 'var(--alert)' : 'var(--cash)';
  $('ap').textContent = String(s.ap);
}

export interface TaskItem { label: string; where: string; done: boolean; final?: boolean; onClick?: () => void }
export function renderTasks(items: TaskItem[], title: string) {
  $('tasksTitle').textContent = title;
  const ol = $('taskList');
  ol.innerHTML = '';
  for (const it of items) {
    const li = document.createElement('li');
    if (it.done) li.className = 'done';
    if (it.final) li.className = 'final';
    li.innerHTML = `<span class="dot"></span><span>${esc(it.label)}</span><span class="where">${esc(it.where)}</span>`;
    if (it.onClick && !it.done) li.addEventListener('click', it.onClick);
    ol.appendChild(li);
  }
}

// ---------------- toasts / slate ----------------
export function toast(text: string, kind: 'good' | 'bad' | '' = '') {
  const box = $('toasts');
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = clean(text);
  box.appendChild(t);
  while (box.children.length > 3) box.firstChild!.remove();
  setTimeout(() => t.remove(), 6500);
}

let slateTimer = 0;
export function slate(title: string, text: string, ms = 9000) {
  const el = $('slate');
  el.innerHTML = `<span class="lbl">${esc(title)}</span><p>${esc(text)}</p><span class="lbl">Tap to dismiss</span>`;
  el.hidden = false;
  clearTimeout(slateTimer);
  slateTimer = window.setTimeout(() => (el.hidden = true), ms);
  el.onclick = () => (el.hidden = true);
}

// ---------------- dialogue ----------------
export interface DialogOption { label: string; hint?: string; cost?: number; disabled?: boolean }
export interface DialogSpec {
  name: string;
  role: string;
  color: string;
  title?: string;
  lines: string[];
  options?: DialogOption[];
  /** return the reaction line (or null) after a pick */
  onPick?: (i: number) => string | null;
  onClose: () => void;
  onLine?: (speaking: boolean) => void;
}

let dialogKey: ((e: KeyboardEvent) => void) | null = null;
export let dialogOpen = false;

export function openDialog(spec: DialogSpec) {
  const el = $('dialog');
  dialogOpen = true;
  el.hidden = false;
  let idx = 0;
  let typing = 0;
  let full = '';
  let shown = 0;
  let phase: 'lines' | 'options' | 'result' = 'lines';
  el.innerHTML = `
    <div class="who"><i style="background:${spec.color}"></i><b>${esc(spec.name)}</b><span>${esc(spec.role)}</span>${spec.title ? `<span class="title">${esc(spec.title)}</span>` : ''}</div>
    <div class="line" id="dlgLine"></div>
    <div class="more" id="dlgMore"></div>
    <div class="opts" id="dlgOpts" hidden></div>`;
  const lineEl = $('dlgLine');
  const moreEl = $('dlgMore');
  const optsEl = $('dlgOpts');

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const type = (text: string) => {
    full = text;
    shown = 0;
    clearInterval(typing);
    spec.onLine?.(true);
    if (reduce) { lineEl.textContent = full; shown = full.length; spec.onLine?.(false); return; }
    typing = window.setInterval(() => {
      shown = Math.min(full.length, shown + 2);
      lineEl.textContent = full.slice(0, shown);
      if (shown >= full.length) { clearInterval(typing); spec.onLine?.(false); }
    }, 16);
  };
  const finishTyping = () => {
    if (shown < full.length) { clearInterval(typing); shown = full.length; lineEl.textContent = full; spec.onLine?.(false); return true; }
    return false;
  };
  const showOptions = () => {
    phase = 'options';
    moreEl.textContent = '';
    optsEl.hidden = false;
    optsEl.innerHTML = '';
    spec.options!.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.disabled = !!o.disabled;
      const cost = o.cost ? `<span class="cost neg">−${money(o.cost).replace('$', '$')}</span>` : '<span class="cost zero">no cost</span>';
      b.innerHTML = `<span class="k">${i + 1}</span><span><b>${esc(o.label)}</b>${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</span>${cost}`;
      b.addEventListener('click', () => pick(i));
      optsEl.appendChild(b);
    });
    (optsEl.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  };
  const pick = (i: number) => {
    if (phase !== 'options' || spec.options![i]?.disabled) return;
    const reaction = spec.onPick?.(i) ?? null;
    optsEl.hidden = true;
    if (reaction) {
      phase = 'result';
      type(reaction);
      moreEl.textContent = 'Tap to continue';
    } else close();
  };
  const advance = () => {
    if (finishTyping()) return;
    if (phase === 'lines') {
      idx++;
      if (idx < spec.lines.length) { type(spec.lines[idx]); moreEl.textContent = idx < spec.lines.length - 1 || spec.options?.length ? 'Tap to continue' : 'Tap to close'; return; }
      if (spec.options?.length) { showOptions(); return; }
      close();
    } else if (phase === 'result') close();
  };
  const close = () => {
    clearInterval(typing);
    el.hidden = true;
    dialogOpen = false;
    if (dialogKey) window.removeEventListener('keydown', dialogKey, true);
    dialogKey = null;
    spec.onLine?.(false);
    spec.onClose();
  };
  lineEl.addEventListener('click', advance);
  moreEl.addEventListener('click', advance);
  dialogKey = (e: KeyboardEvent) => {
    if (phase === 'options' && /^[1-9]$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); pick(Number(e.key) - 1); return; }
    if (phase !== 'options' && (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E')) { e.preventDefault(); e.stopPropagation(); advance(); }
    if (e.key === 'Escape' && !spec.options?.length) { e.preventDefault(); close(); }
  };
  window.addEventListener('keydown', dialogKey, true);
  if (!spec.lines.length) { if (spec.options?.length) showOptions(); return; }
  type(spec.lines[0]);
  moreEl.textContent = spec.lines.length > 1 || spec.options?.length ? 'Tap to continue' : 'Tap to close';
}

export function cardDialogSpec(card: DecisionCard, s: GameState): Pick<DialogSpec, 'name' | 'role' | 'color' | 'title' | 'lines' | 'options'> {
  const c = card.speaker === 'narrator' ? null : CAST[card.speaker];
  return {
    name: c?.name ?? 'Narrator',
    role: c?.role ?? '',
    color: c?.look.clothes ?? '#888',
    title: card.title,
    lines: card.lines.length ? card.lines : ['…'],
    options: card.options.map((o) => ({
      label: o.label,
      hint: o.hint,
      cost: o.cost,
    })),
  };
}

// ---------------- panels ----------------
let panelClose: (() => void) | null = null;
export let panelOpen = false;
/** true while a panel must be answered (no Close button, Esc does nothing) */
export let panelLocked = false;
export function openPanel(title: string, html: string, onClose?: () => void, opts: { noClose?: boolean } = {}) {
  const el = $('panel');
  el.innerHTML = `<header><h2>${esc(title)}</h2>${opts.noClose ? '' : '<button class="x" type="button" id="panelX">Close</button>'}</header><div class="body">${html}</div>`;
  el.hidden = false;
  panelOpen = true;
  panelLocked = !!opts.noClose;
  panelClose = () => { el.hidden = true; panelOpen = false; panelLocked = false; panelClose = null; onClose?.(); };
  if (!opts.noClose) $('panelX').addEventListener('click', () => panelClose?.());
  return el;
}
export function closePanel() { panelClose?.(); }

function lineChart(values: number[], opts: { w?: number; h?: number; label: string; zero?: boolean }) {
  const w = opts.w ?? 640, h = opts.h ?? 150, padL = 56, padR = 12, padT = 12, padB = 22;
  if (values.length < 2) return `<p class="note">The ${opts.label.toLowerCase()} chart fills in after your second month.</p>`;
  const min = Math.min(0, ...values), max = Math.max(...values, 1);
  const x = (i: number) => padL + (i / (values.length - 1)) * (w - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * (h - padT - padB);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${x(0)},${y(Math.max(min, 0))} ${pts} ${x(values.length - 1)},${y(Math.max(min, 0))}`;
  const ticks = [min, (min + max) / 2, max];
  const last = values[values.length - 1];
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(opts.label)} by month">
    ${ticks.map((t) => `<line x1="${padL}" x2="${w - padR}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(233,228,214,0.1)"/><text x="${padL - 6}" y="${y(t) + 3}" text-anchor="end">${money(t).replace('$', '$')}</text>`).join('')}
    ${min < 0 ? `<line x1="${padL}" x2="${w - padR}" y1="${y(0)}" y2="${y(0)}" stroke="rgba(233,228,214,0.35)" stroke-dasharray="3 3"/>` : ''}
    <polygon points="${area}" fill="rgba(72,196,134,0.14)"/>
    <polyline points="${pts}" fill="none" stroke="#48c486" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="${x(values.length - 1)}" cy="${y(last)}" r="4" fill="#48c486"/>
    <text x="${padL}" y="${h - 4}">M1</text><text x="${w - padR}" y="${h - 4}" text-anchor="end">M${values.length}</text>
  </svg>`;
}

function plTable(r: MonthRecord) {
  const row = (k: string, v: number, cls = '') => `<tr class="${cls}"><td>${k}</td><td class="${v < 0 ? 'neg' : ''}">${money(v)}</td></tr>`;
  return `<table class="pl">
    ${row('Revenue', r.revenue)}
    ${row('Cost of goods', -r.cogs)}
    ${row('Rent', -r.rent)}
    ${row('Wages', -r.wages)}
    ${row('Overhead', -r.overhead)}
    ${r.marketingCost ? row('Marketing', -r.marketingCost) : ''}
    ${r.interestPaid ? row('Loan interest', -r.interestPaid) : ''}
    ${r.taxes ? row('Quarterly tax', -r.taxes) : ''}
    ${r.ventureProfit ? row('Other locations', r.ventureProfit) : ''}
    ${row('Profit', r.profit, 'total')}
  </table>`;
}

const bar = (label: string, v: number, color = 'var(--cash)') =>
  `<div class="bar"><span>${label}</span><span class="meter"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${color}"></i></span><span class="num">${Math.round(v)}</span></div>`;

export function booksHtml(s: GameState) {
  const biz = BUSINESSES.find((b) => b.id === s.business)!;
  const loc = LOCATIONS.find((l) => l.id === s.location)!;
  const last = s.history[s.history.length - 1];
  const phase = phaseDisplay(s.macro.phase);
  const cap = Math.round(biz.baseCapacityPerDay * TIER_CAPACITY_MULT[s.storeTier - 1] * 30);
  return `
    <div class="figs">
      <div class="fig"><span class="lbl">Cash</span><b class="${s.cash < 0 ? 'neg' : ''}">${money(s.cash)}</b></div>
      <div class="fig"><span class="lbl">Loan</span><b>${money(s.loan)}</b></div>
      <div class="fig"><span class="lbl">Rate</span><b>${s.interestRate.toFixed(1)}%</b></div>
      <div class="fig"><span class="lbl">Last month</span><b class="${last ? (last.profit >= 0 ? 'pos' : 'neg') : ''}">${last ? signed(last.profit) : '—'}</b></div>
    </div>
    <div><h3 class="sec-h">Cash by month</h3>${lineChart(s.history.map((r) => r.cash), { label: 'Cash' })}</div>
    <div class="grid2">
      <div><h3 class="sec-h">${last ? `${monthName(last.month)} P&amp;L` : 'P&amp;L'}</h3>${last ? plTable(last) : '<p class="note">Your first month is still open. Close it with Priya in the office to see the numbers.</p>'}</div>
      <div><h3 class="sec-h">Health</h3>
        ${bar('Reputation', s.reputation)}
        ${bar('Staff morale', s.morale, s.morale < 45 ? 'var(--loss)' : 'var(--cash)')}
        ${bar('Freshness', 100 - s.fatigue, s.fatigue > 55 ? 'var(--alert)' : 'var(--cash)')}
        ${bar('Premises', s.condition, s.condition < 50 ? 'var(--alert)' : 'var(--cash)')}
        ${bar('Your energy', s.energy, s.energy < 30 ? 'var(--loss)' : 'var(--cash)')}
        <p class="note" style="margin-top:8px">${Math.round(s.loyalty)} regulars · ${last ? `${last.customers.toLocaleString()} customers last month of ~${cap.toLocaleString()} you can serve` : `room for ~${cap.toLocaleString()} customers a month`}</p>
      </div>
    </div>
    <div class="grid2">
      <div><h3 class="sec-h">How you run it</h3><div class="pillrow">
        <span class="pill">${biz.name}</span><span class="pill">${loc.name}</span>
        <span class="pill">Prices: ${PRICE_LEVELS.find((p) => p.id === s.priceLevel)!.name}</span>
        <span class="pill">Ads: ${MARKETING_TIERS.find((m) => m.id === s.marketingTier)!.name}</span>
        <span class="pill">${s.staff} staff</span><span class="pill">Store tier ${s.storeTier}</span>
        <span class="pill">${s.productLines} new lines</span>
      </div></div>
      <div><h3 class="sec-h">The market</h3>
        <p class="note">Economy: <b>${phase.label}</b> · inflation ${s.macro.inflationYoY.toFixed(1)}% a year${last ? ` · your share ${Math.round(last.marketShare * 100)}%` : ''}</p>
        ${s.competitors.length ? `<ul class="news">${s.competitors.map((c) => `<li><b>${esc(c.name)}</b>, ${STANCE_DESC[c.stance]}</li>`).join('')}</ul>` : '<p class="note">No rivals on the block yet. The storefront across the street is still for lease.</p>'}
      </div>
    </div>
    ${s.roster.length ? `<div><h3 class="sec-h">Your team</h3><div class="pillrow">${s.roster.map((m) => `<span class="pill">${esc(m.name)}${m.role === 'manager' ? ' · manager' : ''} · skill ${m.skill} · morale ${Math.round(m.morale)}</span>`).join('')}</div></div>` : ''}
  `;
}

export function recapHtml(o: MonthOutcome, story: string, next: string) {
  const r = o.record;
  return `
    <div class="recap-head"><span class="big ${r.profit >= 0 ? 'pos' : 'neg'}">${signed(r.profit)}</span><span class="note">${r.customers.toLocaleString()} customers · cash now ${money(r.cash)}</span></div>
    <p class="story">${esc(story)}</p>
    <div class="grid2">
      <div><h3 class="sec-h">P&amp;L</h3>${plTable(r)}</div>
      <div><h3 class="sec-h">On the block</h3>
        <ul class="news">
          ${o.eventHeadline ? `<li class="${o.eventGood ? 'pos' : 'neg'}">${esc(clean(o.eventHeadline))}</li>` : ''}
          ${o.headlines.map((h) => `<li>${esc(clean(h))}</li>`).join('')}
          ${r.eventLabels.map((h) => `<li>${esc(clean(h))}</li>`).join('')}
          ${!o.eventHeadline && !o.headlines.length && !r.eventLabels.length ? '<li>A quiet month on the street.</li>' : ''}
        </ul>
      </div>
    </div>
    <div class="go-row"><button class="primary" type="button" id="recapGo">Open ${esc(next)}</button></div>`;
}

export function bankHtml(s: GameState) {
  const canBorrow = s.loan + LOAN_STEP <= LOAN_CAP && s.ap >= LOAN_AP;
  const canRepay = s.loan > 0 && s.cash >= Math.min(LOAN_STEP, s.loan);
  return `
    <div class="figs">
      <div class="fig"><span class="lbl">Your loan</span><b>${money(s.loan)}</b></div>
      <div class="fig"><span class="lbl">Rate</span><b>${s.interestRate.toFixed(1)}%</b></div>
      <div class="fig"><span class="lbl">Credit line</span><b>${money(LOAN_CAP - s.loan)}</b></div>
    </div>
    <p class="note">Walking in off-schedule takes groundwork: ${LOAN_AP} AP per loan. You earn AP by pitching in around the shop.</p>
    <div class="choice-list">
      <button class="choice" type="button" id="bankBorrow" ${canBorrow ? '' : 'disabled'}><b>Borrow ${money(LOAN_STEP)}</b><span class="num">${LOAN_AP} AP</span><small>${s.ap < LOAN_AP ? `You have ${s.ap} AP.` : s.loan + LOAN_STEP > LOAN_CAP ? 'Credit line maxed out.' : `Interest at ${s.interestRate.toFixed(1)}% a year.`}</small></button>
      <button class="choice" type="button" id="bankRepay" ${canRepay ? '' : 'disabled'}><b>Repay ${money(Math.min(LOAN_STEP, s.loan || LOAN_STEP))}</b><span class="num">free</span><small>${s.loan ? 'Less interest every month.' : 'Nothing owed.'}</small></button>
    </div>`;
}

export function adsHtml(s: GameState) {
  return `
    <p class="note">Billed monthly while it runs; switch off any time. Launching a paid campaign off-schedule takes ${ADS_AP} AP. You have ${s.ap}.</p>
    <div class="choice-list">
      ${MARKETING_TIERS.map((t) => {
        const on = s.marketingTier === t.id;
        const needsAp = t.cost > 0 && !on;
        const blocked = needsAp && s.ap < ADS_AP;
        return `<button class="choice ${on ? 'on' : ''}" type="button" data-tier="${t.id}" ${on || blocked ? 'disabled' : ''}><b>${t.name}${on ? ' · running' : ''}</b><span class="num">${t.cost ? money(t.cost * s.macro.cpi) + '/mo' : 'free'}</span><small>${t.desc}${needsAp ? ` · ${ADS_AP} AP` : ''}</small></button>`;
      }).join('')}
    </div>`;
}

export function menuHtml(s: GameState) {
  const m = currentMenu(s);
  return `<p class="note">${esc(m.note)} · ${PRICE_LEVELS.find((p) => p.id === s.priceLevel)!.name} pricing</p>
    <div class="menu-list">${m.lines.map((l) => `<div><span>${esc(l.name)}${l.isNew ? ' <span class="pill">new</span>' : ''}</span><span class="num">${formatPrice(l.price)}</span></div>`).join('')}</div>`;
}

export function endHtml(s: GameState, score: FinalScore) {
  const best = s.history.reduce((a, r) => (r.profit > a ? r.profit : a), -Infinity);
  return `<div class="card">
    <span class="lbl">${s.bankrupt ? 'Closed for good' : `${s.maxMonths} months in business`}</span>
    <div class="grade" aria-label="Grade ${score.grade}">${score.grade}</div>
    <h2>${s.bankrupt ? 'Out of cash' : `Valued at ${money(score.valuation)}`}</h2>
    <p class="note">${esc(score.summary)}</p>
    <div class="figs">
      <div class="fig"><span class="lbl">Months run</span><b>${s.history.length}</b></div>
      <div class="fig"><span class="lbl">Best month</span><b>${isFinite(best) ? signed(best) : '—'}</b></div>
      <div class="fig"><span class="lbl">Reputation</span><b>${Math.round(s.reputation)}</b></div>
    </div>
    <div class="go-row" style="justify-content:center"><button class="primary" type="button" id="endAgain">Start a new run</button></div>
  </div>`;
}

interface LookLite { skin: string; hair: string; hairColor: string; clothes: string }
const HAIR_NAMES: Record<string, string> = { short: 'Short', curly: 'Curly', bun: 'Bun', long: 'Long', cap: 'Cap', bald: 'Shaved', ponytail: 'Ponytail' };

export function setupHtml(
  sel: { business: string; location: string; look: LookLite; name: string },
  hasSave: boolean,
  portraits: string[],
  presets: LookLite[],
  pal: { skins: string[]; hairs: string[]; outfits: string[]; styles: string[] },
) {
  const same = (a: LookLite, b: LookLite) => a.skin === b.skin && a.hair === b.hair && a.hairColor === b.hairColor && a.clothes === b.clothes;
  const sw = (attr: string, colors: string[], cur: string, label: string) => `<div class="swatches" role="group" aria-label="${label}">${colors.map((c) => `<button type="button" class="sw" data-${attr}="${c}" style="--c:${c}" aria-pressed="${c === cur}" aria-label="${label} ${c}"></button>`).join('')}</div>`;
  return `<div class="inner">
    <div class="brand"><h1>Biz<em>Sim</em><br>3D</h1><p>Open a shop on a real block. Walk the neighbourhood, talk to the people who need you, and survive 24 months.</p></div>
    ${hasSave ? `<div class="go-row"><button class="primary" type="button" id="continueRun">Continue your run</button><span class="note">or start a new one below</span></div>` : ''}
    <div class="step"><span class="lbl">1 · What are you opening?</span><div class="opts-grid">
      ${BUSINESSES.map((b) => `<button class="tile" type="button" data-biz="${b.id}" aria-pressed="${sel.business === b.id}"><b>${b.name}</b><small>${esc(b.tagline)}</small><span class="num">~$${b.baseTicket.toFixed(2)} ticket</span></button>`).join('')}
    </div></div>
    <div class="step"><span class="lbl">2 · Where?</span><div class="opts-grid">
      ${LOCATIONS.map((l) => `<button class="tile" type="button" data-loc="${l.id}" aria-pressed="${sel.location === l.id}"><b>${l.name}</b><small>${esc(l.blurb)}</small><span class="num">${money(l.rent)}/mo · ${l.footTrafficPerDay}/day</span></button>`).join('')}
    </div></div>
    <div class="step"><span class="lbl">3 · How do you look?</span>
      <div class="faces">${presets.map((p, i) => `<button type="button" class="face" data-preset="${i}" aria-pressed="${same(p, sel.look)}" aria-label="Look ${i + 1}">${portraits[i] ? `<img src="${portraits[i]}" alt="">` : ''}</button>`).join('')}</div>
      <div class="tune">
        <span class="lbl">Skin</span>${sw('skin', pal.skins, sel.look.skin, 'Skin tone')}
        <span class="lbl">Hair</span><div class="pillrow">${pal.styles.map((h) => `<button type="button" class="chip" data-hair="${h}" aria-pressed="${sel.look.hair === h}">${HAIR_NAMES[h] ?? h}</button>`).join('')}</div>
        <span class="lbl">Hair color</span>${sw('haircolor', pal.hairs, sel.look.hairColor, 'Hair color')}
        <span class="lbl">Outfit</span>${sw('outfit', pal.outfits, sel.look.clothes, 'Outfit')}
      </div>
    </div>
    <div class="step"><label class="field"><span class="lbl">4 · Your name</span><input id="ownerName" maxlength="16" value="${esc(sel.name)}" autocomplete="off" placeholder="Type your name" aria-describedby="nameHint"></label>
      <span class="note" id="nameHint">Pick a name. It goes on the sign over your door.</span></div>
    <div class="go-row"><button class="primary" type="button" id="startRun">Open the doors</button></div>
    <p class="controls-note"><kbd>WASD</kbd> or tap to walk · <kbd>Shift</kbd> to run · drag to look · <kbd>E</kbd> to talk · <kbd>M</kbd> map · <kbd>V</kbd> first person. You start with $20,000 and 24 months.</p>
  </div>`;
}

// ---------------- the map ----------------
export let mapOpen = false;
export function openMap(places: { id: string; name: string }[], onTravel: (id: string) => void) {
  const el = $('map');
  el.innerHTML = `<div class="map-card" role="dialog" aria-modal="true" aria-label="Map">
    <header><h2>The neighbourhood</h2><button class="x" type="button" id="mapX">Close</button></header>
    <div class="map-body">
      <div class="map-canvas"><canvas></canvas></div>
      <aside class="map-side">
        <h3 class="sec-h">Legend</h3>
        <ul class="legend">
          <li><span class="lg you"></span>You</li>
          <li><span class="lg need">!</span>Needs a decision from you</li>
          <li><span class="lg close">$</span>Priya · close the month</li>
          <li><span class="lg place"></span>Place you can travel to</li>
          <li><span class="lg shop"></span>Your shop</li>
          <li><span class="lg road"></span>Street</li>
          <li><span class="lg bldg"></span>Building</li>
          <li><span class="lg park"></span>Park</li>
        </ul>
        <h3 class="sec-h">Travel to</h3>
        <div class="travel">${places.map((p) => `<button type="button" class="secondary" data-go="${p.id}">${esc(p.name)}</button>`).join('')}</div>
        <p class="note">Tap a place on the map or in the list to go straight there.</p>
      </aside>
    </div>
  </div>`;
  el.hidden = false;
  mapOpen = true;
  $('mapX').addEventListener('click', closeMap);
  el.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => onTravel(b.dataset.go!)));
  el.addEventListener('click', (e) => { if (e.target === el) closeMap(); });
  return el;
}
export function closeMap() {
  const el = $('map');
  if (!el) return;
  el.hidden = true;
  el.innerHTML = '';
  mapOpen = false;
}
