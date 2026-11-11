import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { createTabAuthOptions } from './authStorage';

const url = import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || publicAnonKey;
const inBrowser = typeof window !== 'undefined';
const callback = new URLSearchParams(inBrowser ? window.location.hash.slice(1) : '');
const recoveryCallback = callback.get('type') === 'recovery';
const signupCallback = callback.get('type') === 'signup';
export const signupEmailConfirmed = signupCallback && Boolean(callback.get('access_token') && callback.get('refresh_token')) && !callback.has('error');

if (inBrowser && signupCallback) {
  // Supabase has already verified the email. Discard the callback session
  // before the browser client can adopt it.
  const destination = window.location.pathname === '/applicant'
    ? window.location.pathname + window.location.search
    : '/applicant';
  window.history.replaceState(window.history.state, '', destination);
}

export const supabase = createClient(url, key, {
  auth: inBrowser
    ? { ...createTabAuthOptions(window.sessionStorage), detectSessionInUrl: !recoveryCallback && !signupCallback }
    : { persistSession: false },
});

// A recovery link can update a password without signing in to the rest of HRIS.
export const passwordRecoveryClient = recoveryCallback ? createClient(url, key, {
  auth: { storageKey: 'buenaventura_hris_recovery', persistSession: false, autoRefreshToken: false },
}) : null;
