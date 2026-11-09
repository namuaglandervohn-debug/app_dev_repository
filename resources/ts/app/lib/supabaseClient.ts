import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { createTabAuthOptions } from './authStorage';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || publicAnonKey,
  { auth: typeof window !== 'undefined' ? createTabAuthOptions(window.sessionStorage) : { persistSession: false } },
);
