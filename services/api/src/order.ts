import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Order, OrderInput } from '@hometown/types';
import { OrderInputSchema } from '@hometown/types';
import { catalog, priceFor } from './catalog.js';
import { sendOrderEmails } from './email.js';

const memoryOrders: Order[] = [];
const supabase: SupabaseClient | null = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }) : null;

export function getStoreMode() { return supabase ? 'supabase' : 'memory'; }

export async function createOrder(payload: unknown): Promise<Order> {
  const input = OrderInputSchema.parse(payload);
  const items = input.items.map((item) => {
    const product = catalog.find((candidate) => candidate.id === item.productId && candidate.published);
    if (!product) throw new Error(`Sản phẩm ${item.productId} không khả dụng.`);
    const color = product.colors.find((candidate) => candidate.id === item.colorId);
    if (!color) throw new Error(`Màu ${item.colorId} không khả dụng cho ${product.name}.`);
    const unitPrice = priceFor(product, item.colorId, item.base);
    return { ...item, productName: product.name, colorName: color.name, unitPrice, lineTotal: unitPrice * item.quantity };
  });
  const order: Order = { id: crypto.randomUUID(), orderNumber: `HL-${new Date().getFullYear()}-${String(memoryOrders.length + 1).padStart(4, '0')}`, createdAt: new Date().toISOString(), status: 'PENDING', customer: input.customer, items, total: items.reduce((sum, item) => sum + item.lineTotal, 0) };
  if (supabase) {
    const { error } = await supabase.from('orders').insert({ id: order.id, order_number: order.orderNumber, status: order.status, customer_name: order.customer.name, customer_email: order.customer.email, customer_phone: order.customer.phone, shipping_address: order.customer.address, note: order.customer.note, total: order.total, created_at: order.createdAt });
    if (error) throw new Error(`Không thể lưu đơn hàng vào Supabase: ${error.message}`);
    const { error: itemError } = await supabase.from('order_items').insert(order.items.map((item) => ({ order_id: order.id, product_id: item.productId, product_name: item.productName, color_id: item.colorId, color_name: item.colorName, base: item.base, quantity: item.quantity, unit_price: item.unitPrice, line_total: item.lineTotal })));
    if (itemError) throw new Error(`Không thể lưu sản phẩm trong đơn hàng: ${itemError.message}`);
  } else memoryOrders.push(order);
  await sendOrderEmails(order);
  return order;
}

export async function listOrders(): Promise<Order[]> {
  if (!supabase) return [...memoryOrders].reverse();
  const { data, error } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, orderNumber: row.order_number, createdAt: row.created_at, status: row.status, customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone, address: row.shipping_address, note: row.note ?? '' }, items: row.order_items ?? [], total: row.total })) as Order[];
}
