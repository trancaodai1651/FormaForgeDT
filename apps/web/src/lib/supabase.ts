import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const authConfigured = Boolean(supabase);

export type CustomerAddress = {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  email: string;
  phone: string;
  address: string;
  is_default: boolean;
};
export type CustomerAddressInput = Omit<CustomerAddress, 'id' | 'user_id' | 'label' | 'is_default'>;

export async function getCurrentUser(): Promise<User | null> { if (!supabase) return null; const { data } = await supabase.auth.getUser(); return data.user; }
export async function getAccessToken(): Promise<string | null> { if (!supabase) return null; const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? null; }
export async function signInAdmin(email: string, password: string): Promise<User> { if (!supabase) throw new Error('Supabase Auth chưa được cấu hình cho web.'); const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error || !data.user) throw new Error(error?.message ?? 'Đăng nhập thất bại.'); return data.user; }
export async function signInCustomer(email: string, password: string): Promise<User> { return signInAdmin(email, password); }
export async function signUpCustomer(email: string, password: string, displayName: string): Promise<{ user: User | null; session: Session | null }> {
  if (!supabase) throw new Error('Supabase Auth chưa được cấu hình cho web.');
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
  if (error) throw new Error(error.message);
  return { user: data.user, session: data.session };
}
export async function getDefaultCustomerAddress(userId?: string): Promise<CustomerAddress | null> {
  if (!supabase) return null;
  const currentUser = userId ?? (await getCurrentUser())?.id;
  if (!currentUser) return null;
  const { data, error } = await supabase.from('customer_addresses').select('*').eq('user_id', currentUser).eq('is_default', true).maybeSingle();
  if (error) throw new Error(error.message);
  return data as CustomerAddress | null;
}
export async function saveDefaultCustomerAddress(input: CustomerAddressInput, userId?: string): Promise<CustomerAddress> {
  if (!supabase) throw new Error('Supabase Auth chưa được cấu hình cho web.');
  const currentUser = userId ?? (await getCurrentUser())?.id;
  if (!currentUser) throw new Error('Bạn cần đăng nhập để lưu địa chỉ.');
  const { data, error } = await supabase.from('customer_addresses').upsert({ ...input, user_id: currentUser, label: 'default', is_default: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id,label' }).select('*').single();
  if (error) throw new Error(error.message);
  return data as CustomerAddress;
}
export async function signOutAdmin() { if (supabase) await supabase.auth.signOut(); }
