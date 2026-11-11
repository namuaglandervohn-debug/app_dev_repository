import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { createTabAuthOptions } from './authStorage';

const url = import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || publicAnonKey;
const inBrowser = typeof window !== 'undefined';
const recoveryCallback = inBrowser && new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';

export const supabase = createClient(url, key, {
  auth: inBrowser
    ? { ...createTabAuthOptions(window.sessionStorage), detectSessionInUrl: !recoveryCallback }
    : { persistSession: false },
});

// A recovery link can update a password without signing in to the rest of HRIS.
export const passwordRecoveryClient = recoveryCallback ? createClient(url, key, {
  auth: { storageKey: 'buenaventura_hris_recovery', persistSession: false, autoRefreshToken: false },
}) : null;
