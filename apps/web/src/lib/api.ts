import type { Order, OrderInput, OrderStatus, Product } from '@hometown/types';

export type AdminOverview = { store: string; orders: number; products: number; collections: number; designProjects: number; lampDesigns: number; emailLogs: number };
export type AdminSettings = { shop_name: string; owner_name: string | null; email: string | null; phone: string | null; facebook: string | null; zalo: string | null; website: string | null; address: string | null; social_links: Record<string, unknown> };
export type AdminGeometry = { projects: Array<{ id: string; name: string; version: string; product_id: string | null; autosaved_at: string; created_at: string }>; lampDesigns: Array<{ id: string; version: string; product_id: string | null; published: boolean; created_at: string }> };

const apiBase = import.meta.env.VITE_API_URL as string | undefined;
export const apiConfigured = Boolean(apiBase);
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!apiBase) throw new Error('API chưa được cấu hình. Hãy chạy services/api hoặc đặt VITE_API_URL.');
  const response = await fetch(`${apiBase}${path}`, options);
  const payload = await response.json().catch(() => null) as { message?: string } | T | null;
  if (!response.ok) throw new Error((payload && typeof payload === 'object' && 'message' in payload ? payload.message : null) ?? 'Không thể kết nối máy chủ.');
  return payload as T;
}
export async function submitOrder(input: OrderInput): Promise<Order> {
  return request<Order>('/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
}
export function getProducts() { return request<Product[]>('/products'); }
export function getOrder(id: string) { return request<Order>(`/orders/${encodeURIComponent(id)}`); }
export function listAdminOrders(accessToken: string) { return request<Order[]>('/admin/orders', { headers: { authorization: `Bearer ${accessToken}` } }); }
export function updateAdminOrderStatus(id: string, status: OrderStatus, accessToken: string) { return request<Order>(`/admin/orders/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ status }) }); }
export function getAdminOverview(accessToken: string) { return request<AdminOverview>('/admin/overview', { headers: { authorization: `Bearer ${accessToken}` } }); }
export function getAdminGeometry(accessToken: string) { return request<AdminGeometry>('/admin/geometry', { headers: { authorization: `Bearer ${accessToken}` } }); }
export function getAdminSettings(accessToken: string) { return request<AdminSettings>('/admin/settings', { headers: { authorization: `Bearer ${accessToken}` } }); }
export function updateAdminSettings(settings: Partial<AdminSettings>, accessToken: string) { return request<AdminSettings>('/admin/settings', { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify(settings) }); }
