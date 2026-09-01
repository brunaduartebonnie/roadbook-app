/* ═══════════════════════════════════════════
   ROADBOOK — Supabase Config
═══════════════════════════════════════════ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://gtgklxevhiysceumsgxy.supabase.co';
const SUPABASE_ANON = 'sb_publishable_g4lMXZ-5YEalDpJj9TWWsA_tQK7cZon';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  }
});

/* ── Helper: get current user (null if not signed in) ── */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/* ── Helper: get profile + account_id ── */
export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*, accounts(*)')
    .eq('id', userId)
    .single();
  return data;
}

/* ── Helper: redirect guard ── */
export async function requireAuth(redirectTo = '/index.html') {
  const user = await getUser();
  if (!user) { window.location.href = redirectTo; return null; }
  return user;
}

export async function requireNoAuth(redirectTo = '/app.html') {
  const user = await getUser();
  if (user) { window.location.href = redirectTo; return null; }
  return true;
}
