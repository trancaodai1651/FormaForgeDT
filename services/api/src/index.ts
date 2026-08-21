import './env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { OrderStatusSchema } from '@hometown/types';
import { getCatalog } from './catalog.js';
import { assertAdmin, assertAuthenticated, createOrder, getOrder, listOrders, updateOrderStatus } from './order.js';
import { getStoreMode } from './db.js';
import { getAdminGeometry, getAdminOverview, getAdminSettings, updateAdminSettings } from './admin.js';
import { PriceReaderError, deleteTrackedPriceProduct, inspectPriceUrl, listTrackedPriceProducts, refreshTrackedPriceProduct, trackPriceProduct } from './priceReader.js';

const app = Fastify({ logger: { level: process.env.NODE_ENV === 'production' ? 'info' : 'warn' } });
await app.register(cors, { origin: true }); await app.register(helmet); await app.register(rateLimit, { max: 30, timeWindow: '1 minute' });
app.get('/health', async () => ({ ok: true, service: 'hometown-api', store: getStoreMode() }));
app.get('/api/products', async () => getCatalog());
app.post('/api/orders', async (request, reply) => { try { const order = await createOrder(request.body); return reply.code(201).send(order); } catch (error) { if (error instanceof ZodError) return reply.code(400).send({ message: 'Dữ liệu đơn hàng không hợp lệ.', issues: error.issues }); return reply.code(400).send({ message: error instanceof Error ? error.message : 'Đơn hàng chưa được tạo.' }); } });
app.get('/api/orders/:id', async (request, reply) => { try { const order = await getOrder((request.params as { id: string }).id); return order ? reply.send(order) : reply.code(404).send({ message: 'Không tìm thấy đơn hàng.' }); } catch (error) { return reply.code(500).send({ message: error instanceof Error ? error.message : 'Không thể tải đơn hàng.' }); } });
app.get('/api/admin/orders', async (request, reply) => { try { await assertAdmin(request.headers.authorization); return reply.send(await listOrders()); } catch (error) { return reply.code(401).send({ message: error instanceof Error ? error.message : 'Không thể tải đơn hàng.' }); } });
app.patch('/api/admin/orders/:id', async (request, reply) => { try { await assertAdmin(request.headers.authorization); const body = request.body as { status?: unknown }; const status = OrderStatusSchema.parse(body?.status); return reply.send(await updateOrderStatus((request.params as { id: string }).id, status)); } catch (error) { if (error instanceof ZodError) return reply.code(400).send({ message: 'Trạng thái đơn hàng không hợp lệ.', issues: error.issues }); return reply.code(400).send({ message: error instanceof Error ? error.message : 'Không thể cập nhật đơn hàng.' }); } });
app.get('/api/admin/overview', async (request, reply) => { try { await assertAdmin(request.headers.authorization); return reply.send(await getAdminOverview()); } catch (error) { return reply.code(401).send({ message: error instanceof Error ? error.message : 'Không thể tải tổng quan.' }); } });
app.get('/api/admin/geometry', async (request, reply) => { try { await assertAdmin(request.headers.authorization); return reply.send(await getAdminGeometry()); } catch (error) { return reply.code(401).send({ message: error instanceof Error ? error.message : 'Không thể tải geometry projects.' }); } });
app.get('/api/admin/settings', async (request, reply) => { try { await assertAdmin(request.headers.authorization); return reply.send(await getAdminSettings()); } catch (error) { return reply.code(401).send({ message: error instanceof Error ? error.message : 'Không thể tải settings.' }); } });
app.patch('/api/admin/settings', async (request, reply) => { try { await assertAdmin(request.headers.authorization); return reply.send(await updateAdminSettings((request.body ?? {}) as Record<string, unknown>)); } catch (error) { return reply.code(401).send({ message: error instanceof Error ? error.message : 'Không thể cập nhật settings.' }); } });
app.post('/api/admin/price-reader/inspect', async (request, reply) => {
  try {
    await assertAdmin(request.headers.authorization);
    const url = (request.body as { url?: unknown } | null)?.url;
    if (typeof url !== 'string' || !url.trim()) return reply.code(400).send({ message: 'Thiếu đường dẫn sản phẩm.', code: 'INVALID_URL' });
    return reply.send(await inspectPriceUrl(url));
  } catch (error) {
    if (error instanceof PriceReaderError) return reply.code(error.code === 'PROVIDER_NOT_CONFIGURED' ? 503 : error.code === 'PROVIDER_ERROR' ? 502 : 400).send({ message: error.message, code: error.code, parsed: error.parsed });
    return reply.code(401).send({ message: error instanceof Error ? error.message : 'Không thể đọc giá sản phẩm.' });
  }
});
app.get('/api/admin/price-reader/products', async (request, reply) => { try { await assertAdmin(request.headers.authorization); return reply.send(await listTrackedPriceProducts()); } catch (error) { return reply.code(401).send({ message: error instanceof Error ? error.message : 'Không thể tải danh sách sản phẩm.' }); } });
app.post('/api/admin/price-reader/products', async (request, reply) => { try { await assertAdmin(request.headers.authorization); const url = (request.body as { url?: unknown } | null)?.url; if (typeof url !== 'string' || !url.trim()) return reply.code(400).send({ message: 'Thiếu đường dẫn sản phẩm.', code: 'INVALID_URL' }); return reply.code(201).send(await trackPriceProduct(url)); } catch (error) { if (error instanceof PriceReaderError) return reply.code(error.code === 'PROVIDER_NOT_CONFIGURED' ? 503 : error.code === 'PROVIDER_ERROR' ? 502 : 400).send({ message: error.message, code: error.code, parsed: error.parsed }); return reply.code(400).send({ message: error instanceof Error ? error.message : 'Không thể lưu sản phẩm.' }); } });
app.post('/api/admin/price-reader/products/:id/refresh', async (request, reply) => { try { await assertAdmin(request.headers.authorization); return reply.send(await refreshTrackedPriceProduct((request.params as { id: string }).id)); } catch (error) { if (error instanceof PriceReaderError) return reply.code(error.code === 'PROVIDER_NOT_CONFIGURED' ? 503 : error.code === 'PROVIDER_ERROR' ? 502 : 400).send({ message: error.message, code: error.code, parsed: error.parsed }); return reply.code(400).send({ message: error instanceof Error ? error.message : 'Không thể cập nhật sản phẩm.' }); } });
app.delete('/api/admin/price-reader/products/:id', async (request, reply) => { try { await assertAdmin(request.headers.authorization); await deleteTrackedPriceProduct((request.params as { id: string }).id); return reply.code(204).send(); } catch (error) { return reply.code(400).send({ message: error instanceof Error ? error.message : 'Không thể xóa sản phẩm.' }); } });
app.post('/api/price-reader/inspect', async (request, reply) => {
  try {
    await assertAuthenticated(request.headers.authorization);
    const url = (request.body as { url?: unknown } | null)?.url;
    if (typeof url !== 'string' || !url.trim()) return reply.code(400).send({ message: 'Thiếu đường dẫn sản phẩm.', code: 'INVALID_URL' });
    return reply.send(await inspectPriceUrl(url));
  } catch (error) {
    if (error instanceof PriceReaderError) return reply.code(error.code === 'PROVIDER_NOT_CONFIGURED' ? 503 : error.code === 'PROVIDER_ERROR' ? 502 : 400).send({ message: error.message, code: error.code, parsed: error.parsed });
    return reply.code(401).send({ message: error instanceof Error ? error.message : 'Không thể đọc giá sản phẩm.' });
  }
});
app.get('/api/price-reader/products', async (request, reply) => { try { const user = await assertAuthenticated(request.headers.authorization); return reply.send(await listTrackedPriceProducts(user.id)); } catch (error) { return reply.code(401).send({ message: error instanceof Error ? error.message : 'Không thể tải danh sách sản phẩm.' }); } });
app.post('/api/price-reader/products', async (request, reply) => { try { const user = await assertAuthenticated(request.headers.authorization); const url = (request.body as { url?: unknown } | null)?.url; if (typeof url !== 'string' || !url.trim()) return reply.code(400).send({ message: 'Thiếu đường dẫn sản phẩm.', code: 'INVALID_URL' }); return reply.code(201).send(await trackPriceProduct(url, user.id)); } catch (error) { if (error instanceof PriceReaderError) return reply.code(error.code === 'PROVIDER_NOT_CONFIGURED' ? 503 : error.code === 'PROVIDER_ERROR' ? 502 : 400).send({ message: error.message, code: error.code, parsed: error.parsed }); return reply.code(400).send({ message: error instanceof Error ? error.message : 'Không thể lưu sản phẩm.' }); } });
app.post('/api/price-reader/products/:id/refresh', async (request, reply) => { try { const user = await assertAuthenticated(request.headers.authorization); return reply.send(await refreshTrackedPriceProduct((request.params as { id: string }).id, user.id)); } catch (error) { if (error instanceof PriceReaderError) return reply.code(error.code === 'PROVIDER_NOT_CONFIGURED' ? 503 : error.code === 'PROVIDER_ERROR' ? 502 : 400).send({ message: error.message, code: error.code, parsed: error.parsed }); return reply.code(400).send({ message: error instanceof Error ? error.message : 'Không thể cập nhật sản phẩm.' }); } });
app.delete('/api/price-reader/products/:id', async (request, reply) => { try { const user = await assertAuthenticated(request.headers.authorization); await deleteTrackedPriceProduct((request.params as { id: string }).id, user.id); return reply.code(204).send(); } catch (error) { return reply.code(400).send({ message: error instanceof Error ? error.message : 'Không thể xóa sản phẩm.' }); } });
const port = Number(process.env.API_PORT ?? 8787); await app.listen({ port, host: '0.0.0.0' });
export { app };
