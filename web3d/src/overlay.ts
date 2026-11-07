// BizSim mentor overlay: adds a "Mentor" button to the live game without touching its code.
// It reads the game's own save (localStorage) to see your business, and asks Claude
// through the published page. Nothing here can break the game: it is a separate script.
import { askMentor, mentorSnapshot, type MentorMode, type MentorSnapshot } from '../../src/game/mentor';
import type { GameState } from '../../src/game/types';

const SAVE_KEY = 'bizsim3d.save.v1';
const SEEN_KEY = 'bizsim3d.mentor.seen';
// '' = ask Claude directly (published claude.ai page). Otherwise the mentor server's URL,
// set at build time: MENTOR_URL=http://localhost:8787 node web3d/build.mjs
const mentorUrl = () => String((window as unknown as { BIZSIM_MENTOR_URL?: string }).BIZSIM_MENTOR_URL ?? '');

type Props = Record<string, unknown>;
function h(tag: string, props: Props = {}, ...kids: (Node | string)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids) el.append(kid);
  return el;
}

function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const s = raw ? (JSON.parse(raw) as GameState) : null;
    return s && typeof s.cash === 'number' ? s : null;
  } catch { return null; }
}

/** If the game's save has a shape this module doesn't know, send the plain numbers instead of failing. */
function rawSnapshot(s: GameState): MentorSnapshot {
  const a = s as unknown as Record<string, unknown>;
  const pick = (k: string) => (typeof a[k] === 'number' ? Math.round(a[k] as number) : 0);
  return {
    business: String(a.business ?? ''), location: String(a.location ?? ''),
    month: pick('month') + 1, maxMonths: pick('maxMonths') || 24, cash: pick('cash'), loan: pick('loan'),
    interestRate: pick('interestRate'), reputation: pick('reputation'), staffMorale: pick('morale'),
    customerFatigue: pick('fatigue'), ownerEnergy: pick('energy'), ap: pick('ap'), premisesCondition: pick('condition'),
    price: String(a.priceLevel ?? ''), marketing: String(a.marketingTier ?? ''), staff: pick('staff'), storeTier: pick('storeTier'),
    economy: '', rivals: [], activeEffects: [], cardsWaiting: 0,
  };
}
function snapshotOf(s: GameState): MentorSnapshot {
  try { return mentorSnapshot(s); } catch { return rawSnapshot(s); }
}

const CSS = `
#mentorModal{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));background:rgba(8,11,14,.62)}
#mentorModal.on{display:flex}
#mentorCard{width:min(94vw,540px);max-height:86vh;overflow:auto;background:var(--ink,#131a21);color:var(--text,#f1ede3);border:1px solid var(--line,rgba(233,228,214,.14));border-radius:14px;padding:16px;font-family:var(--f-body,system-ui,sans-serif)}
#mentorCard h2{margin:0 0 4px;font-family:var(--f-display,system-ui,sans-serif);font-size:20px}
#mentorCard .sub{margin:0 0 10px;color:var(--muted,#a3b1bd);font-size:14px}
#mentorCard .row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
#mentorCard button{min-height:44px;padding:9px 14px;border-radius:10px;border:1px solid var(--line,rgba(233,228,214,.14));background:var(--ink-2,#1d2731);color:inherit;font:700 14px var(--f-display,system-ui,sans-serif);cursor:pointer}
#mentorCard button.primary{background:var(--accent,#f2b632);color:#1b2129;border-color:transparent}
#mentorCard button:disabled{opacity:.5;cursor:default}
#mentorCard input{flex:1;min-width:0;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid var(--line,rgba(233,228,214,.14));background:var(--ink-2,#1d2731);color:inherit;font:16px var(--f-body,system-ui,sans-serif)}
#mentorOut{margin-top:10px;white-space:pre-wrap;line-height:1.45;font-size:15px}
#mentorBtn.pulse{animation:mentorPulse 1.6s ease-in-out infinite}
@keyframes mentorPulse{0%,100%{box-shadow:0 0 0 0 rgba(242,182,50,.55)}50%{box-shadow:0 0 0 8px rgba(242,182,50,0)}}
@media (prefers-reduced-motion:reduce){#mentorBtn.pulse{animation:none}}`;

function formatReply(r: { message: string; recommendations?: { action: string; reason: string; risk: string }[] }): string {
  const recs = r.recommendations?.length
    ? '\n\n' + r.recommendations.map((x, i) => `${i + 1}. ${x.action}\n   Why: ${x.reason} (risk: ${x.risk})`).join('\n')
    : '';
  return r.message + recs;
}

// Read by the game's tutorial step "Meet your mentor". `ready` is only true once the button exists,
// so the tutorial can never wait on a mentor that failed to start.
const status = { ready: false, open: false, closes: 0, uses: 0, askAbout: (_question: string) => {} };
(window as unknown as { __bizsimMentor: typeof status }).__bizsimMentor = status;

function build() {
  if (document.getElementById('mentorBtn')) return;
  document.head.append(h('style', { text: CSS }));

  const out = h('div', { id: 'mentorOut' });
  const input = h('input', { id: 'mentorQ', type: 'text', maxlength: '300', placeholder: 'e.g. Should I borrow money?', enterkeyhint: 'send' }) as HTMLInputElement;
  const advise = h('button', { type: 'button', class: 'primary', text: 'What should I do?' }) as HTMLButtonElement;
  const recap = h('button', { type: 'button', text: 'Explain last month' }) as HTMLButtonElement;
  const askBtn = h('button', { type: 'button', text: 'Ask' }) as HTMLButtonElement;
  const closeBtn = h('button', { type: 'button', text: 'Close' });
  const card = h('div', { id: 'mentorCard', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Mentor' },
    h('h2', { text: 'Your mentor' }),
    h('p', { class: 'sub', text: 'Claude looks at your business and answers. The first time, your browser asks permission.' }),
    h('div', { class: 'row' }, advise, recap),
    h('div', { class: 'row' }, input, askBtn),
    out,
    h('div', { class: 'row' }, closeBtn));
  const modal = h('div', { id: 'mentorModal' }, card);
  document.body.append(modal);

  // keep game controls from reacting to anything done inside the panel
  for (const ev of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove', 'wheel', 'contextmenu']) {
    modal.addEventListener(ev, (e) => e.stopPropagation());
  }

  const controls = [advise, recap, askBtn];
  let busy = false;
  async function ask(mode: MentorMode, question?: string) {
    if (busy) return;
    const s = loadState();
    if (!s) { out.textContent = 'Start a run first, then I can see your business.'; return; }
    if (mode === 'debrief' && !(s.history && s.history.length)) { out.textContent = 'Close your first month first, then I can explain what happened.'; return; }
    busy = true;
    controls.forEach((b) => (b.disabled = true));
    out.textContent = 'Thinking…';
    // a free host puts an idle server to sleep; its first answer can take up to a minute
    const slow = mentorUrl() ? setTimeout(() => { out.textContent = 'Waking the mentor up. The first answer can take up to a minute…'; }, 8000) : 0;
    try {
      const r = await askMentor(mentorUrl(), { mode, question, snapshot: snapshotOf(s) }, mentorUrl() ? 60000 : undefined);
      out.textContent = r ? formatReply(r) : 'The mentor couldn’t answer. If a permission prompt appeared, tap again and allow it. If this isn’t claude.ai, the mentor server may be offline.';
    } finally {
      clearTimeout(slow);
      busy = false;
      controls.forEach((b) => (b.disabled = false));
      status.uses++; // counts every real attempt, answered or not, so the tutorial can never get stuck
    }
  }
  advise.addEventListener('click', () => void ask('advise'));
  recap.addEventListener('click', () => void ask('debrief'));
  const send = () => { const q = input.value.trim(); if (q) void ask('ask', q); };
  askBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') send(); });

  const close = () => { modal.classList.remove('on'); if (status.open) { status.open = false; status.closes++; } };
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') close(); });

  const btn = h('button', { id: 'mentorBtn', class: 'hud-card hud-btn', type: 'button', text: 'Mentor' });
  try { if (!localStorage.getItem(SEEN_KEY)) btn.classList.add('pulse'); } catch { /* storage unavailable */ }
  const openPanel = () => {
    try { document.exitPointerLock?.(); } catch { /* not locked */ }
    btn.classList.remove('pulse');
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage unavailable */ }
    out.textContent = '';
    status.open = true;
    modal.classList.add('on');
  };
  btn.addEventListener('click', openPanel);
  // the tutorial's "Meet your mentor" step has a button marked data-mentor-open
  document.addEventListener('click', (e) => {
    const t = e.target as Element | null;
    if (t && typeof t.closest === 'function' && t.closest('[data-mentor-open]')) openPanel();
  });
  (document.getElementById('hud-right') ?? document.body).append(btn);
  // "Give me a second to think" in the game: open the mentor with that decision already asked
  status.askAbout = (question: string) => { openPanel(); input.value = question; void ask('ask', question); };
  // The mentor is reachable inside claude.ai (the page can ask Claude) or when a server URL was built in.
  // Anywhere else there is nothing to ask, so the button stays hidden and the tutorial skips its mentor step.
  const claudeBridge = () => typeof (window as unknown as { claude?: { use?: unknown } }).claude?.use === 'function';
  const onClaudeHost = () => /claude/i.test(location.hostname);
  const available = () => !!mentorUrl() || claudeBridge() || onClaudeHost();
  const refresh = () => { const ok = available(); status.ready = ok; btn.style.display = ok ? '' : 'none'; };
  refresh();
  // wake a sleeping server now, so the first real question is not the one that waits
  if (mentorUrl()) void fetch(`${mentorUrl().replace(/\/$/, '')}/health`).catch(() => {});
  // Claude's bridge can arrive a moment after the page: check again on load and for a few seconds
  window.addEventListener('load', refresh);
  let tries = 0;
  const timer = setInterval(() => { refresh(); if (++tries >= 20 || available()) clearInterval(timer); }, 500);
}

try {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
} catch (e) { console.warn('[mentor] overlay failed to start', e); }
