import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { catalog } from './catalog.js';
import { assertAdmin, createOrder, getStoreMode, listOrders } from './order.js';

const app = Fastify({ logger: { level: process.env.NODE_ENV === 'production' ? 'info' : 'warn' } });
await app.register(cors, { origin: true }); await app.register(helmet); await app.register(rateLimit, { max: 30, timeWindow: '1 minute' });
app.get('/health', async () => ({ ok: true, service: 'hometown-api', store: getStoreMode() }));
app.get('/api/products', async () => catalog.filter((product) => product.published));
app.post('/api/orders', async (request, reply) => { try { const order = await createOrder(request.body); return reply.code(201).send(order); } catch (error) { if (error instanceof ZodError) return reply.code(400).send({ message: 'Dữ liệu đơn hàng không hợp lệ.', issues: error.issues }); return reply.code(400).send({ message: error instanceof Error ? error.message : 'Đơn hàng chưa được tạo.' }); } });
app.get('/api/admin/orders', async (request, reply) => { try { await assertAdmin(request.headers.authorization); return reply.send(await listOrders()); } catch (error) { return reply.code(401).send({ message: error instanceof Error ? error.message : 'Không thể tải đơn hàng.' }); } });
const port = Number(process.env.API_PORT ?? 8787); await app.listen({ port, host: '0.0.0.0' });
export { app };
