import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { createTabAuthOptions } from './authStorage';

const url = import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || publicAnonKey;
const inBrowser = typeof window !== 'undefined';
const callback = new URLSearchParams(inBrowser ? window.location.hash.slice(1) : '');
const recoveryCallback = callback.get('type') === 'recovery';
const signupCallback = callback.get('type') === 'signup';
let signupEmailConfirmed = signupCallback && Boolean(callback.get('access_token') && callback.get('refresh_token')) && !callback.has('error');

export function consumeSignupEmailConfirmation() {
  const confirmed = signupEmailConfirmed;
  signupEmailConfirmed = false;
  return confirmed;
}

if (inBrowser && signupCallback) {
  // Supabase has already verified the email. Discard the callback session
  // before the browser client can adopt it.
  const destination = window.location.pathname === '/applicant'
    ? window.location.pathname + window.location.search
    : '/applicant';
  window.history.replaceState(window.history.state, '', destination);
}

const staffDataProxyFetch: typeof fetch = async (input, init) => {
  const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const canProxy = typeof window !== 'undefined'
    && requestUrl.startsWith(url)
    && new URL(requestUrl).pathname.startsWith('/rest/v1/');

  if (!canProxy) return fetch(input, init);

  const target = new URL(requestUrl);
  const proxyPath = `${target.pathname}${target.search}`;
  const proxyOrigin = window.location.hostname.endsWith('vercel.app')
    ? ''
    : 'https://app-dev-repository.vercel.app';
  return fetch(`${proxyOrigin}/api/supabase-staff-proxy?path=${encodeURIComponent(proxyPath)}`, init);
};

export const supabase = createClient(url, key, {
  global: { fetch: staffDataProxyFetch },
  auth: inBrowser
    ? { ...createTabAuthOptions(window.sessionStorage), detectSessionInUrl: !recoveryCallback && !signupCallback }
    : { persistSession: false },
});

// A recovery link can update a password without signing in to the rest of HRIS.
export const passwordRecoveryClient = recoveryCallback ? createClient(url, key, {
  auth: { storageKey: 'buenaventura_hris_recovery', persistSession: false, autoRefreshToken: false },
}) : null;
