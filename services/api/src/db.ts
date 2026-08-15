import './env.js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const supabase: SupabaseClient | null = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

export function getStoreMode() { return supabase ? 'supabase' : 'memory'; }
