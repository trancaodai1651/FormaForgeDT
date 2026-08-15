import type { Order, OrderInput, OrderStatus } from '@hometown/types';

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
export function getOrder(id: string) { return request<Order>(`/orders/${encodeURIComponent(id)}`); }
export function listAdminOrders(accessToken: string) { return request<Order[]>('/admin/orders', { headers: { authorization: `Bearer ${accessToken}` } }); }
export function updateAdminOrderStatus(id: string, status: OrderStatus, accessToken: string) { return request<Order>(`/admin/orders/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ status }) }); }
