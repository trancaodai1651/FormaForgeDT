import type { Order, OrderInput } from '@hometown/types';

const apiBase = import.meta.env.VITE_API_URL as string | undefined;
export async function submitOrder(input: OrderInput): Promise<Order> {
  if (!apiBase) throw new Error('API chưa được cấu hình. Hãy chạy services/api hoặc đặt VITE_API_URL.');
  const response = await fetch(`${apiBase}/orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  if (!response.ok) { const payload = await response.json().catch(() => null) as { message?: string } | null; throw new Error(payload?.message ?? 'Không thể tạo đơn hàng.'); }
  return response.json() as Promise<Order>;
}
