import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const authConfigured = Boolean(supabase);

export async function getCurrentUser(): Promise<User | null> { if (!supabase) return null; const { data } = await supabase.auth.getUser(); return data.user; }
export async function signInAdmin(email: string, password: string): Promise<User> { if (!supabase) throw new Error('Supabase Auth chưa được cấu hình cho web.'); const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error || !data.user) throw new Error(error?.message ?? 'Đăng nhập thất bại.'); return data.user; }
export async function signOutAdmin() { if (supabase) await supabase.auth.signOut(); }
