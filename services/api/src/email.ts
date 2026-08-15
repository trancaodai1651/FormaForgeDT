import './env.js';
import nodemailer from 'nodemailer';
import type { Order } from '@hometown/types';
import { formatEmail } from './email-template.js';

export type EmailProvider = { send: (message: { to: string; subject: string; html: string }) => Promise<void> };
const logger = (message: string) => console.info(`[email] ${message}`);

function createProvider(): EmailProvider | null {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: Number(process.env.SMTP_PORT ?? 587) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  return { send: async (message) => { await transport.sendMail({ from: process.env.SMTP_FROM ?? process.env.SHOP_EMAIL, ...message }); } };
}

export async function sendOrderEmails(order: Order) {
  const provider = createProvider();
  if (!provider) { logger(`development mode — skipped email for ${order.orderNumber}`); return; }
  const customerHtml = formatEmail(order, false); const adminHtml = formatEmail(order, true); const shopEmail = process.env.SHOP_EMAIL ?? 'hello@hometownlamp.com';
  await Promise.all([provider.send({ to: order.customer.email, subject: `Hometown Lamp — ${order.orderNumber}`, html: customerHtml }), provider.send({ to: process.env.ADMIN_EMAIL ?? shopEmail, subject: `[New order] ${order.orderNumber}`, html: adminHtml })]);
}
