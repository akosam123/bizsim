/**
 * Local BizSim backend: accounts, progress records, streaks, leaderboard.
 *
 * This exists so the whole feature is RUNNABLE without a hosted service. It
 * implements the same surface the Supabase path does, so the client code is
 * identical either way and switching later is a base-URL change.
 *
 * What it deliberately does NOT do: send real email. In dev the six-digit code
 * is printed to this console and returned in the response, so the verification
 * flow can be exercised. A hosted backend replaces that with a real send.
 *
 *   node server/index.mjs          # listens on 8787
 *
 * Storage is a single JSON file next to this script. Fine for one machine and
 * a few players; a real deployment wants Postgres.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(HERE, 'data.json');
const PORT = Number(process.env.PORT || 8787);

const blank = { profiles: {}, runs: {}, days: [], codes: {}, sessions: {} };
let db = existsSync(DB_PATH) ? JSON.parse(readFileSync(DB_PATH, 'utf8')) : { ...blank };
for (const k of Object.keys(blank)) db[k] ??= blank[k];

const save = () => writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

/** Streaks are decided here, not on the client, so moving the device clock
 *  forward cannot manufacture one. */
function touchStreak(profile) {
  const d = today();
  if (profile.last_played_on !== d) {
    const gap = profile.last_played_on ? daysBetween(profile.last_played_on, d) : null;
    profile.current_streak = gap === 1 ? (profile.current_streak || 0) + 1 : 1;
    profile.longest_streak = Math.max(profile.longest_streak || 0, profile.current_streak);
    profile.last_played_on = d;
  }
  return { current: profile.current_streak, longest: profile.longest_streak };
}

function leaderboard() {
  const rows = Object.values(db.profiles).map((p) => {
    const mine = Object.values(db.runs).filter((r) => r.user_id === p.id);
    return {
      user_id: p.id,
      display_name: p.display_name,
      current_streak: p.current_streak || 0,
      longest_streak: p.longest_streak || 0,
      // ranked on the BEST balance ever reached, so one bad month does not
      // erase a good run and nobody is punished for continuing to play
      best_cash: mine.reduce((m, r) => Math.max(m, Number(r.best_cash || 0)), 0),
      runs_played: mine.length,
    };
  });
  rows.sort((a, b) => b.best_cash - a.best_cash);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

const userFor = (req) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const id = db.sessions[token];
  return id ? db.profiles[id] : null;
};

const send = (res, code, body) => {
  const payload = JSON.stringify(body ?? {});
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
  });
  res.end(payload);
};

const routes = {
  /* ---------------------------------------------------------------- auth -- */
  'POST /auth/request-code': (req, res, body) => {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'Enter a valid email.' });
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    db.codes[email] = { code, expires: Date.now() + 10 * 60 * 1000 };
    save();
    console.log(`\n  login code for ${email}: ${code}\n`);
    // dev only: a hosted backend emails this instead of returning it
    return send(res, 200, { ok: true, devCode: code });
  },

  'POST /auth/verify': (req, res, body) => {
    const email = String(body.email || '').trim().toLowerCase();
    const entry = db.codes[email];
    if (!entry || entry.code !== String(body.code || '').trim()) {
      return send(res, 400, { error: 'That code did not work.' });
    }
    if (Date.now() > entry.expires) return send(res, 400, { error: 'That code has expired.' });
    delete db.codes[email];

    let profile = Object.values(db.profiles).find((p) => p.email === email);
    if (!profile) {
      const id = randomUUID();
      // a placeholder the player renames on first launch; the suffix keeps
      // display names unique when two addresses share a local part
      profile = {
        id, email,
        display_name: `${email.split('@')[0]}-${id.slice(0, 4)}`,
        current_streak: 0, longest_streak: 0, last_played_on: null,
      };
      db.profiles[id] = profile;
    }
    const token = randomUUID();
    db.sessions[token] = profile.id;
    save();
    return send(res, 200, { token, profile });
  },

  /* ------------------------------------------------------------- profile -- */
  'GET /me': (req, res) => {
    const p = userFor(req);
    return p ? send(res, 200, p) : send(res, 401, { error: 'Not signed in.' });
  },

  'PATCH /me': (req, res, body) => {
    const p = userFor(req);
    if (!p) return send(res, 401, { error: 'Not signed in.' });
    const name = String(body.display_name || '').trim();
    if (name.length < 2 || name.length > 24) return send(res, 400, { error: 'Pick 2 to 24 characters.' });
    const taken = Object.values(db.profiles)
      .some((o) => o.id !== p.id && o.display_name.toLowerCase() === name.toLowerCase());
    if (taken) return send(res, 409, { error: 'That name is taken. Try another.' });
    p.display_name = name;
    save();
    return send(res, 200, p);
  },

  'POST /streak': (req, res) => {
    const p = userFor(req);
    if (!p) return send(res, 401, { error: 'Not signed in.' });
    const out = touchStreak(p);
    save();
    return send(res, 200, out);
  },

  /* -------------------------------------------------------------- progress */
  'POST /runs': (req, res, body) => {
    const p = userFor(req);
    if (!p) return send(res, 401, { error: 'Not signed in.' });
    const id = randomUUID();
    db.runs[id] = {
      id, user_id: p.id,
      business: body.business, location: body.location, owner_name: body.owner_name,
      started_at: new Date().toISOString(), ended_at: null,
      best_cash: 0, final_cash: null, months: 0,
    };
    save();
    return send(res, 200, { id });
  },

  'POST /runs/day': (req, res, body) => {
    const p = userFor(req);
    if (!p) return send(res, 401, { error: 'Not signed in.' });
    const run = db.runs[body.run_id];
    if (!run || run.user_id !== p.id) return send(res, 404, { error: 'No such run.' });
    // The client speaks camelCase and the store is snake_case. Matching on the
    // wrong spelling made game_day undefined on every row, so each month
    // overwrote the last instead of appending -- normalise before comparing.
    const gameDay = body.game_day ?? body.gameDay;
    const row = {
      run_id: body.run_id,
      user_id: p.id,
      game_day: gameDay,
      game_month: body.game_month ?? body.gameMonth,
      revenue: body.revenue, costs: body.costs,
      profit: body.profit, cash: body.cash,
      recorded_at: new Date().toISOString(),
    };
    if (gameDay == null) return send(res, 400, { error: 'game_day is required.' });
    // idempotent on (run, day): replaying a month corrects it, never doubles it
    const i = db.days.findIndex((d) => d.run_id === body.run_id && d.game_day === gameDay);
    if (i >= 0) db.days[i] = row; else db.days.push(row);
    save();
    return send(res, 200, { ok: true });
  },

  'PATCH /runs': (req, res, body) => {
    const p = userFor(req);
    if (!p) return send(res, 401, { error: 'Not signed in.' });
    const run = db.runs[body.run_id];
    if (!run || run.user_id !== p.id) return send(res, 404, { error: 'No such run.' });
    run.best_cash = Math.max(Number(run.best_cash || 0), Number(body.cash || 0));
    run.months = body.months ?? run.months;
    if (body.ended) { run.ended_at = new Date().toISOString(); run.final_cash = body.cash; }
    save();
    return send(res, 200, { ok: true });
  },

  /* ---------------------------------------------------------- leaderboard -- */
  'GET /leaderboard': (req, res) => send(res, 200, leaderboard().slice(0, 50)),

  'GET /leaderboard/me': (req, res) => {
    const p = userFor(req);
    if (!p) return send(res, 401, { error: 'Not signed in.' });
    return send(res, 200, leaderboard().find((r) => r.user_id === p.id) ?? null);
  },
};

createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const path = req.url.split('?')[0].replace(/\/$/, '');
  const handler = routes[`${req.method} ${path}`];
  if (!handler) return send(res, 404, { error: `No route for ${req.method} ${path}` });

  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { return send(res, 400, { error: 'Bad JSON.' }); }
    try { handler(req, res, body); } catch (e) { send(res, 500, { error: String(e) }); }
  });
}).listen(PORT, () => {
  console.log(`BizSim backend on http://localhost:${PORT}`);
  console.log(`  ${Object.keys(db.profiles).length} players, ${Object.keys(db.runs).length} runs`);
});
