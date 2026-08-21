import './env.js';
import type { Order, OrderInput, OrderStatus, Product } from '@hometown/types';
import { OrderInputSchema, OrderStatusSchema } from '@hometown/types';
import { getCatalog, priceFor } from './catalog.js';
import { getStoreMode, supabase } from './db.js';
import { sendOrderEmails } from './email.js';

const memoryOrders: Order[] = [];

export async function assertAuthenticated(authorization?: string) {
  if (!supabase) throw new Error('API chưa được cấu hình Supabase.');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Yêu cầu đăng nhập.');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Phiên đăng nhập không hợp lệ.');
  return data.user;
}

export async function assertAdmin(authorization?: string) {
  if (!supabase) throw new Error('Admin API chưa được cấu hình Supabase.');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Yêu cầu đăng nhập admin.');
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) throw new Error('Phiên đăng nhập không hợp lệ.');
  const { data: profile, error: profileError } = await supabase.from('users').select('role').eq('id', authData.user.id).maybeSingle();
  if (profileError || profile?.role !== 'ADMIN') throw new Error('Tài khoản không có quyền ADMIN.');
}

async function nextOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `HL-${year}-`;
  if (!supabase) return `${prefix}${String(memoryOrders.length + 1).padStart(4, '0')}`;
  const { data, error } = await supabase.from('orders').select('order_number').like('order_number', `${prefix}%`).order('order_number', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Không thể tạo mã đơn hàng: ${error.message}`);
  const lastNumber = Number(String(data?.order_number ?? '').split('-').at(-1));
  return `${prefix}${String(Number.isFinite(lastNumber) ? lastNumber + 1 : 1).padStart(4, '0')}`;
}

async function resolveDatabaseProductId(product: Product): Promise<string | null> {
  if (!supabase) return product.id;
  const { data, error } = await supabase.from('products').select('id').eq('sku', product.sku).maybeSingle();
  if (error) throw new Error(`Không thể xác định sản phẩm ${product.sku}: ${error.message}`);
  return data?.id ?? null;
}

function mapOrderRow(row: any): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    status: OrderStatusSchema.parse(row.status),
    customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone, address: row.shipping_address, note: row.note ?? '' },
    items: (row.order_items ?? []).map((item: any) => ({
      productId: item.product_id ?? '',
      colorId: item.color_id,
      base: item.base,
      quantity: item.quantity,
      productName: item.product_name,
      colorName: item.color_name,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
    })),
    total: row.total,
  };
}

export async function createOrder(payload: unknown): Promise<Order> {
  const input = OrderInputSchema.parse(payload);
  const catalog = await getCatalog();
  const items = input.items.map((item) => {
    const product = catalog.find((candidate) => candidate.id === item.productId && candidate.published);
    if (!product) throw new Error(`Sản phẩm ${item.productId} không khả dụng.`);
    const color = product.colors.find((candidate) => candidate.id === item.colorId);
    if (!color) throw new Error(`Màu ${item.colorId} không khả dụng cho ${product.name}.`);
    const unitPrice = priceFor(product, item.colorId, item.base);
    return { ...item, productName: product.name, colorName: color.name, unitPrice, lineTotal: unitPrice * item.quantity };
  });
  const order: Order = { id: crypto.randomUUID(), orderNumber: await nextOrderNumber(), createdAt: new Date().toISOString(), status: 'PENDING', customer: input.customer, items, total: items.reduce((sum, item) => sum + item.lineTotal, 0) };
  if (supabase) {
    const { error } = await supabase.from('orders').insert({ id: order.id, order_number: order.orderNumber, status: order.status, customer_name: order.customer.name, customer_email: order.customer.email, customer_phone: order.customer.phone, shipping_address: order.customer.address, note: order.customer.note, total: order.total, created_at: order.createdAt });
    if (error) throw new Error(`Không thể lưu đơn hàng vào Supabase: ${error.message}`);
    const databaseItems = await Promise.all(order.items.map(async (item) => ({ order_id: order.id, product_id: await resolveDatabaseProductId(catalog.find((product) => product.id === item.productId)!), product_name: item.productName, color_id: item.colorId, color_name: item.colorName, base: item.base, quantity: item.quantity, unit_price: item.unitPrice, line_total: item.lineTotal })));
    const { error: itemError } = await supabase.from('order_items').insert(databaseItems);
    if (itemError) throw new Error(`Không thể lưu sản phẩm trong đơn hàng: ${itemError.message}`);
  } else memoryOrders.push(order);
  try { await sendOrderEmails(order); } catch (error) { console.warn(`[email] ${error instanceof Error ? error.message : 'failed to send order email'}`); }
  return order;
}

export async function listOrders(): Promise<Order[]> {
  if (!supabase) return [...memoryOrders].reverse();
  const { data, error } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapOrderRow);
}

export async function getOrder(id: string): Promise<Order | null> {
  if (!supabase) return memoryOrders.find((order) => order.id === id) ?? null;
  const { data, error } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapOrderRow(data) : null;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const parsedStatus = OrderStatusSchema.parse(status);
  if (!supabase) {
    const order = memoryOrders.find((candidate) => candidate.id === id);
    if (!order) throw new Error('Đơn hàng không tồn tại.');
    order.status = parsedStatus;
    return order;
  }
  const { data, error } = await supabase.from('orders').update({ status: parsedStatus, updated_at: new Date().toISOString() }).eq('id', id).select('*, order_items(*)').single();
  if (error || !data) throw new Error(error?.message ?? 'Không thể cập nhật đơn hàng.');
  return mapOrderRow(data);
}
