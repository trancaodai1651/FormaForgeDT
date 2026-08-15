import { getCatalog } from './catalog.js';
import { getStoreMode, supabase } from './db.js';
import { listOrders } from './order.js';

export type AdminOverview = {
  store: string;
  orders: number;
  products: number;
  collections: number;
  designProjects: number;
  lampDesigns: number;
  emailLogs: number;
};

export type AdminSettings = {
  shop_name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  facebook: string | null;
  zalo: string | null;
  website: string | null;
  address: string | null;
  social_links: Record<string, unknown>;
};

const defaultSettings: AdminSettings = {
  shop_name: process.env.SHOP_NAME ?? 'Hometown Modular Lamp', owner_name: null,
  email: process.env.SHOP_EMAIL ?? null, phone: process.env.SHOP_PHONE ?? null,
  facebook: null, zalo: null, website: process.env.SHOP_WEBSITE ?? null,
  address: process.env.SHOP_ADDRESS ?? null, social_links: {},
};

async function count(table: string) {
  if (!supabase) return 0;
  const result = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  if (!supabase) return { store: getStoreMode(), orders: (await listOrders()).length, products: (await getCatalog()).length, collections: 0, designProjects: 0, lampDesigns: 0, emailLogs: 0 };
  const [orders, products, collections, designProjects, lampDesigns, emailLogs] = await Promise.all([
    count('orders'), count('products'), count('collections'), count('design_projects'), count('lamp_designs'), count('email_logs'),
  ]);
  return { store: getStoreMode(), orders, products, collections, designProjects, lampDesigns, emailLogs };
}

export async function getAdminSettings(): Promise<AdminSettings> {
  if (!supabase) return defaultSettings;
  const { data, error } = await supabase.from('contact_settings').select('shop_name, owner_name, email, phone, facebook, zalo, website, address, social_links').eq('id', true).maybeSingle();
  if (error) throw new Error(error.message);
  return { ...defaultSettings, ...(data ?? {}) };
}

export async function updateAdminSettings(input: Partial<AdminSettings>): Promise<AdminSettings> {
  if (!supabase) return { ...defaultSettings, ...input };
  const allowed = ['shop_name', 'owner_name', 'email', 'phone', 'facebook', 'zalo', 'website', 'address', 'social_links'] as const;
  const values = Object.fromEntries(allowed.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
  const { data, error } = await supabase.from('contact_settings').upsert({ id: true, ...values, updated_at: new Date().toISOString() }).select('shop_name, owner_name, email, phone, facebook, zalo, website, address, social_links').single();
  if (error) throw new Error(error.message);
  return { ...defaultSettings, ...(data ?? {}) };
}

export async function getAdminGeometry() {
  if (!supabase) return { projects: [], lampDesigns: [] };
  const [projects, lampDesigns] = await Promise.all([
    supabase.from('design_projects').select('id, name, version, product_id, autosaved_at, created_at').order('autosaved_at', { ascending: false }).limit(50),
    supabase.from('lamp_designs').select('id, version, product_id, published, created_at').order('created_at', { ascending: false }).limit(50),
  ]);
  if (projects.error) throw new Error(projects.error.message);
  if (lampDesigns.error) throw new Error(lampDesigns.error.message);
  return { projects: projects.data ?? [], lampDesigns: lampDesigns.data ?? [] };
}
