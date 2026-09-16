/* ═══════════════════════════════════════════
   ROADBOOK — Auth helpers
═══════════════════════════════════════════ */

import { supabase } from './config.js';

/* ── Sign up with email + password ── */
export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } }
  });
  return { data, error };
}

/* ── Sign in with email + password ── */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

/* ── Sign in with Google OAuth ── */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/onboarding`,
      queryParams: { prompt: 'select_account' }
    }
  });
  return { data, error };
}

/* ── Forgot password ── */
export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/index.html?mode=reset`
  });
  return { data, error };
}

/* ── Update password (after reset link) ── */
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  return { data, error };
}

/* ── Sign out ── */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (!error) window.location.href = '/';
}

/* ── Has account? Route to correct page after auth ── */
export async function routeAfterAuth(user) {
  if (!user) { window.location.href = '/'; return; }
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('id', user.id)
    .single();
  if (profile?.account_id) {
    window.location.href = '/app';
  } else {
    window.location.href = '/onboarding';
  }
}
