/**
 * Accounts, progress and the world leaderboard.
 *
 * Everything here degrades quietly: if Supabase isn't configured the app still
 * runs as a local single-player game, `isConfigured()` returns false, and the
 * calling screens hide the online parts rather than erroring. That keeps the
 * game playable while keys are missing and makes offline play a non-event.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BusinessId, GameState, LocationId } from './types';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** A local backend (server/index.mjs) is used when no hosted one is set, so
 *  the whole flow is runnable and testable without any third-party account. */
const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';
const useLocal = !(URL && ANON);

export function isConfigured(): boolean {
  return Boolean(URL && ANON) || Boolean(API);
}

let token: string | null = null;
const TOKEN_KEY = 'bizsim.token';

async function api(path: string, init: RequestInit = {}): Promise<any> {
  if (token === null) token = (await AsyncStorage.getItem(TOKEN_KEY)) ?? '';
  const res = await fetch(API + path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

let client: SupabaseClient | null = null;

function db(): SupabaseClient | null {
  if (!isConfigured()) return null;
  if (!client) {
    client = createClient(URL, ANON, {
      auth: {
        // the session has to survive a reload, and AsyncStorage is the store
        // that works on web and native alike in this project
        storage: AsyncStorage as any,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export interface Profile {
  id: string;
  display_name: string;
  email: string | null;
  current_streak: number;
  longest_streak: number;
  last_played_on: string | null;
}

export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  best_cash: number;
  runs_played: number;
  current_streak: number;
  longest_streak: number;
  rank: number;
}

/* ------------------------------------------------------------------ auth -- */

/** Send a six-digit code to an email address. No password, no reset flow. */
export async function sendCode(email: string): Promise<{ ok: boolean; error?: string }> {
  if (useLocal) {
    try { await api('/auth/request-code', { method: 'POST', body: JSON.stringify({ email }) }); return { ok: true }; }
    catch (e: any) { return { ok: false, error: e.message }; }
  }
  const c = db();
  if (!c) return { ok: false, error: 'Online play is not configured yet.' };
  const { error } = await c.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Exchange the emailed code for a session. This is the verification step. */
export async function verifyCode(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
  if (useLocal) {
    try {
      const r = await api('/auth/verify', { method: 'POST', body: JSON.stringify({ email, code }) });
      token = r.token;
      await AsyncStorage.setItem(TOKEN_KEY, r.token);
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  }
  const c = db();
  if (!c) return { ok: false, error: 'Online play is not configured yet.' };
  const { error } = await c.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  if (useLocal) { token = ''; await AsyncStorage.removeItem(TOKEN_KEY); return; }
  await db()?.auth.signOut();
}

export async function currentProfile(): Promise<Profile | null> {
  if (useLocal) { try { return await api('/me'); } catch { return null; } }
  const c = db();
  if (!c) return null;
  const { data: session } = await c.auth.getUser();
  if (!session.user) return null;
  const { data } = await c
    .from('profiles')
    .select('id, display_name, email, current_streak, longest_streak, last_played_on')
    .eq('id', session.user.id)
    .single();
  return (data as Profile) ?? null;
}

/** Names are unique, so this reports the clash rather than throwing. */
export async function setDisplayName(name: string): Promise<{ ok: boolean; error?: string }> {
  if (useLocal) {
    try { await api('/me', { method: 'PATCH', body: JSON.stringify({ display_name: name }) }); return { ok: true }; }
    catch (e: any) { return { ok: false, error: e.message }; }
  }
  const c = db();
  if (!c) return { ok: false, error: 'Online play is not configured yet.' };
  const { data: session } = await c.auth.getUser();
  if (!session.user) return { ok: false, error: 'Not signed in.' };
  const { error } = await c
    .from('profiles')
    .update({ display_name: name.trim() })
    .eq('id', session.user.id);
  if (!error) return { ok: true };
  const taken = error.code === '23505';
  return { ok: false, error: taken ? 'That name is taken. Try another.' : error.message };
}

/* -------------------------------------------------------------- progress -- */

/** Open a run record. Returns its id, which the caller keeps for the session. */
export async function startRun(
  business: BusinessId, location: LocationId, ownerName: string,
): Promise<string | null> {
  if (useLocal) {
    try { return (await api('/runs', { method: 'POST', body: JSON.stringify({ business, location, owner_name: ownerName }) })).id; }
    catch { return null; }
  }
  const c = db();
  if (!c) return null;
  const { data: session } = await c.auth.getUser();
  if (!session.user) return null;
  const { data, error } = await c
    .from('runs')
    .insert({ user_id: session.user.id, business, location, owner_name: ownerName })
    .select('id')
    .single();
  return error ? null : (data?.id ?? null);
}

/**
 * Record a day's trading. Idempotent on (run, day), so replaying a day after a
 * reload corrects the row instead of adding a second one.
 */
export async function recordDay(
  runId: string,
  day: { gameDay: number; gameMonth: number; revenue: number; costs: number; profit: number; cash: number },
): Promise<void> {
  if (useLocal) {
    try { await api('/runs/day', { method: 'POST', body: JSON.stringify({ run_id: runId, ...day }) }); } catch {}
    return;
  }
  const c = db();
  if (!c || !runId) return;
  const { data: session } = await c.auth.getUser();
  if (!session.user) return;
  await c.from('daily_records').upsert({
    run_id: runId,
    user_id: session.user.id,
    game_day: day.gameDay,
    game_month: day.gameMonth,
    revenue: day.revenue,
    costs: day.costs,
    profit: day.profit,
    cash: day.cash,
  }, { onConflict: 'run_id,game_day' });
}

/** Keep the run's headline figures current; the leaderboard reads these. */
export async function updateRun(
  runId: string, s: GameState, ended = false,
): Promise<void> {
  if (useLocal) {
    try { await api('/runs', { method: 'PATCH', body: JSON.stringify({ run_id: runId, cash: s.cash, months: s.month, ended }) }); } catch {}
    return;
  }
  const c = db();
  if (!c || !runId) return;
  const { data: existing } = await c.from('runs').select('best_cash').eq('id', runId).single();
  const best = Math.max(Number(existing?.best_cash ?? 0), s.cash);
  await c.from('runs').update({
    best_cash: best,
    months: s.month,
    ...(ended ? { ended_at: new Date().toISOString(), final_cash: s.cash } : {}),
  }).eq('id', runId);
}

/* --------------------------------------------------------------- streaks -- */

/**
 * Advance the daily play streak. The decision is made in Postgres against the
 * server's date, so moving the device clock forward cannot manufacture one.
 */
export async function touchStreak(): Promise<{ current: number; longest: number } | null> {
  if (useLocal) { try { return await api('/streak', { method: 'POST' }); } catch { return null; } }
  const c = db();
  if (!c) return null;
  const { data, error } = await c.rpc('touch_streak');
  if (error || !data?.length) return null;
  return { current: data[0].current_streak, longest: data[0].longest_streak };
}

/* ----------------------------------------------------------- leaderboard -- */

export async function leaderboard(limit = 50): Promise<LeaderboardRow[]> {
  if (useLocal) { try { return await api('/leaderboard'); } catch { return []; } }
  const c = db();
  if (!c) return [];
  const { data } = await c
    .from('leaderboard')
    .select('*')
    .order('rank', { ascending: true })
    .limit(limit);
  return (data as LeaderboardRow[]) ?? [];
}

/** The signed-in player's own row, so it can be pinned when they're off-screen. */
export async function myRank(): Promise<LeaderboardRow | null> {
  if (useLocal) { try { return await api('/leaderboard/me'); } catch { return null; } }
  const c = db();
  if (!c) return null;
  const { data: session } = await c.auth.getUser();
  if (!session.user) return null;
  const { data } = await c.from('leaderboard').select('*').eq('user_id', session.user.id).single();
  return (data as LeaderboardRow) ?? null;
}
