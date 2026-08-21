import './env.js';
import { supabase } from './db.js';
import {
  MarketplaceSourceSchema,
  PriceReaderProductSchema,
  PriceReaderPromotionSchema,
  PriceReaderVariantSchema,
  type MarketplaceSource,
  type PriceReaderProduct,
} from '@hometown/types';

export type ParsedPriceUrl = {
  source: MarketplaceSource;
  sourceLabel: string;
  sourceProductId: string;
  normalizedUrl: string;
};

export class PriceReaderError extends Error {
  constructor(public readonly code: 'INVALID_URL' | 'UNSUPPORTED_MARKETPLACE' | 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_ERROR', message: string, public readonly parsed?: ParsedPriceUrl) {
    super(message);
    this.name = 'PriceReaderError';
  }
}

const sourceLabels: Record<MarketplaceSource, string> = {
  taobao: 'Taobao',
  tmall: 'Tmall',
  '1688': '1688',
  pinduoduo: 'Pinduoduo',
  jd: 'JD.com',
  xiaohongshu: 'Xiaohongshu',
  unknown: 'Marketplace',
};

function getSource(hostname: string): MarketplaceSource {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'item.taobao.com' || host.endsWith('.taobao.com')) return 'taobao';
  if (host === 'detail.tmall.com' || host.endsWith('.tmall.com')) return 'tmall';
  if (host === 'detail.1688.com' || host.endsWith('.1688.com')) return '1688';
  if (host === 'yangkeduo.com' || host.endsWith('.yangkeduo.com') || host === 'pinduoduo.com' || host.endsWith('.pinduoduo.com')) return 'pinduoduo';
  if (host === 'jd.com' || host.endsWith('.jd.com')) return 'jd';
  if (host === 'xiaohongshu.com' || host.endsWith('.xiaohongshu.com') || host.endsWith('.xhslink.com')) return 'xiaohongshu';
  return 'unknown';
}

function getProductId(url: URL, source: MarketplaceSource): string | null {
  const queryId = url.searchParams.get('id') ?? url.searchParams.get('goods_id') ?? url.searchParams.get('skuId') ?? url.searchParams.get('sku');
  if (queryId) return queryId;
  if (source === '1688') return url.pathname.match(/\/offer\/(\d+)/i)?.[1] ?? null;
  if (source === 'jd') return url.pathname.match(/\/(\d+)\.html/i)?.[1] ?? null;
  if (source === 'xiaohongshu') return url.pathname.match(/\/item\/([\w-]+)/i)?.[1] ?? null;
  return url.pathname.match(/(?:item|product|offer)[^\d]*(\d{5,})/i)?.[1] ?? null;
}

export function parsePriceUrl(rawUrl: string): ParsedPriceUrl {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new PriceReaderError('INVALID_URL', 'Hãy nhập một đường dẫn sản phẩm hợp lệ.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new PriceReaderError('INVALID_URL', 'Đường dẫn phải bắt đầu bằng http:// hoặc https://.');
  const source = MarketplaceSourceSchema.parse(getSource(url.hostname));
  if (source === 'unknown') throw new PriceReaderError('UNSUPPORTED_MARKETPLACE', 'Chưa hỗ trợ sàn này. Hãy dùng link Taobao, Tmall, 1688, Pinduoduo, JD hoặc Xiaohongshu.');
  const sourceProductId = getProductId(url, source);
  if (!sourceProductId) throw new PriceReaderError('INVALID_URL', 'Không đọc được mã sản phẩm từ đường dẫn này.', { source, sourceLabel: sourceLabels[source], sourceProductId: '', normalizedUrl: url.toString() });
  return { source, sourceLabel: sourceLabels[source], sourceProductId, normalizedUrl: url.toString() };
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeProviderProduct(raw: unknown, parsed: ParsedPriceUrl, exchangeRateVnd: number, providerName: string): PriceReaderProduct {
  const root = recordValue(raw);
  const payload = recordValue(root.product ?? root.data ?? raw);
  const rawVariants = Array.isArray(payload.variants) ? payload.variants : [];
  const fallbackPrice = numberValue(payload.priceCny ?? payload.price ?? payload.currentPrice);
  const variants = (rawVariants.length ? rawVariants : fallbackPrice !== undefined ? [{ id: 'default', label: 'Default', priceCny: fallbackPrice }] : []).map((item, index) => {
    const value = recordValue(item);
    const attributes = recordValue(value.skuAttributes ?? value.attributes ?? value.sku);
    return PriceReaderVariantSchema.parse({
      id: stringValue(value.id ?? value.skuId) ?? `variant-${index + 1}`,
      label: stringValue(value.label ?? value.name) ?? (Object.values(attributes).join(' / ') || `Variant ${index + 1}`),
      priceCny: numberValue(value.priceCny ?? value.price ?? value.currentPrice) ?? 0,
      originalPriceCny: numberValue(value.originalPriceCny ?? value.originalPrice ?? value.marketPrice),
      stock: numberValue(value.stock ?? value.quantity) === undefined ? undefined : Math.max(0, Math.floor(numberValue(value.stock ?? value.quantity)!)),
      skuAttributes: Object.fromEntries(Object.entries(attributes).map(([key, itemValue]) => [key, String(itemValue)])),
    });
  });
  const promotions = (Array.isArray(payload.promotions) ? payload.promotions : []).map((item, index) => {
    const value = recordValue(item);
    return PriceReaderPromotionSchema.parse({
      id: stringValue(value.id) ?? `promotion-${index + 1}`,
      title: stringValue(value.title ?? value.name) ?? 'Promotion',
      description: stringValue(value.description ?? value.detail),
      discountCny: numberValue(value.discountCny ?? value.discount),
      finalPriceCny: numberValue(value.finalPriceCny ?? value.finalPrice ?? value.price),
      startsAt: stringValue(value.startsAt ?? value.startTime),
      endsAt: stringValue(value.endsAt ?? value.endTime),
      source: stringValue(value.source),
    });
  });
  if (!variants.length) throw new PriceReaderError('PROVIDER_ERROR', 'Nhà cung cấp không trả về giá hoặc biến thể sản phẩm.');
  const imageUrl = stringValue(payload.imageUrl ?? payload.image ?? payload.picUrl);
  const candidate = {
    id: stringValue(payload.id) ?? crypto.randomUUID(),
    source: parsed.source,
    sourceLabel: parsed.sourceLabel,
    sourceProductId: parsed.sourceProductId,
    url: parsed.normalizedUrl,
    title: stringValue(payload.title ?? payload.name) ?? `${parsed.sourceLabel} ${parsed.sourceProductId}`,
    ...(imageUrl && /^https?:\/\//i.test(imageUrl) ? { imageUrl } : {}),
    ...(stringValue(payload.shopName ?? payload.shop) ? { shopName: stringValue(payload.shopName ?? payload.shop) } : {}),
    currency: 'CNY' as const,
    exchangeRateVnd,
    variants,
    promotions,
    updatedAt: new Date().toISOString(),
    provider: providerName,
  };
  return PriceReaderProductSchema.parse(candidate);
}

export async function inspectPriceUrl(rawUrl: string): Promise<PriceReaderProduct> {
  const parsed = parsePriceUrl(rawUrl);
  const providerUrl = process.env.PRICE_READER_PROVIDER_URL?.trim();
  if (!providerUrl) throw new PriceReaderError('PROVIDER_NOT_CONFIGURED', 'Chưa cấu hình PRICE_READER_PROVIDER_URL cho bộ đọc giá. Hãy kết nối một provider có API chính thức hoặc dịch vụ dữ liệu được cấp phép.', parsed);
  const exchangeRateVnd = Number(process.env.PRICE_READER_EXCHANGE_RATE_VND ?? 3500);
  if (!Number.isFinite(exchangeRateVnd) || exchangeRateVnd <= 0) throw new PriceReaderError('PROVIDER_ERROR', 'PRICE_READER_EXCHANGE_RATE_VND không hợp lệ.', parsed);
  let response: Response;
  try {
    response = await fetch(providerUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(process.env.PRICE_READER_PROVIDER_TOKEN ? { authorization: `Bearer ${process.env.PRICE_READER_PROVIDER_TOKEN}` } : {}) },
      body: JSON.stringify({ url: parsed.normalizedUrl, source: parsed.source, productId: parsed.sourceProductId }),
    });
  } catch (error) {
    throw new PriceReaderError('PROVIDER_ERROR', `Không thể kết nối provider: ${error instanceof Error ? error.message : 'network error'}`, parsed);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new PriceReaderError('PROVIDER_ERROR', `Provider trả về HTTP ${response.status}.`, parsed);
  return normalizeProviderProduct(body, parsed, exchangeRateVnd, new URL(providerUrl).hostname);
}

const memoryTracked = new Map<string, { product: PriceReaderProduct; history: PriceReaderProduct[] }>();

function productFromRow(row: Record<string, any>): PriceReaderProduct {
  return PriceReaderProductSchema.parse({
    id: row.id,
    source: row.source,
    sourceLabel: row.source_label,
    sourceProductId: row.source_product_id,
    url: row.url,
    title: row.title,
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    ...(row.shop_name ? { shopName: row.shop_name } : {}),
    currency: 'CNY',
    exchangeRateVnd: Number(row.exchange_rate_vnd),
    variants: row.variants ?? [],
    promotions: row.promotions ?? [],
    updatedAt: row.updated_at ?? row.last_checked_at,
    provider: row.provider,
  });
}

export async function listTrackedPriceProducts(): Promise<PriceReaderProduct[]> {
  if (!supabase) return [...memoryTracked.values()].map(({ product }) => product).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const { data, error } = await supabase.from('price_reader_products').select('*').order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => productFromRow(row as Record<string, any>));
}

export async function trackPriceProduct(rawUrl: string): Promise<PriceReaderProduct> {
  const product = await inspectPriceUrl(rawUrl);
  if (!supabase) {
    const previous = memoryTracked.get(product.url);
    const tracked = { product: previous?.product.id ? { ...product, id: previous.product.id } : product, history: [...(previous?.history ?? []), product] };
    memoryTracked.set(product.url, tracked);
    return tracked.product;
  }
  const { data: existing, error: existingError } = await supabase.from('price_reader_products').select('id').eq('normalized_url', product.url).maybeSingle();
  if (existingError) throw new Error(existingError.message);
  const id = existing?.id ?? product.id;
  const row = {
    id,
    source: product.source,
    source_label: product.sourceLabel,
    source_product_id: product.sourceProductId,
    url: product.url,
    normalized_url: product.url,
    title: product.title,
    image_url: product.imageUrl ?? null,
    shop_name: product.shopName ?? null,
    provider: product.provider,
    exchange_rate_vnd: product.exchangeRateVnd,
    variants: product.variants,
    promotions: product.promotions,
    last_checked_at: product.updatedAt,
    updated_at: product.updatedAt,
  };
  const { data, error } = await supabase.from('price_reader_products').upsert(row, { onConflict: 'normalized_url' }).select('*').single();
  if (error || !data) throw new Error(error?.message ?? 'Không thể lưu sản phẩm theo dõi.');
  const { error: snapshotError } = await supabase.from('price_reader_snapshots').insert({ product_id: id, payload: product, captured_at: product.updatedAt });
  if (snapshotError) throw new Error(snapshotError.message);
  return productFromRow(data as Record<string, any>);
}

export async function refreshTrackedPriceProduct(id: string): Promise<PriceReaderProduct> {
  if (!supabase) {
    const entry = [...memoryTracked.values()].find(({ product }) => product.id === id);
    if (!entry) throw new Error('Không tìm thấy sản phẩm đang theo dõi.');
    const refreshed = await inspectPriceUrl(entry.product.url);
    const product = { ...refreshed, id };
    entry.product = product;
    entry.history.push(product);
    return product;
  }
  const { data: existing, error: existingError } = await supabase.from('price_reader_products').select('url').eq('id', id).maybeSingle();
  if (existingError || !existing) throw new Error(existingError?.message ?? 'Không tìm thấy sản phẩm đang theo dõi.');
  const refreshed = await inspectPriceUrl(existing.url);
  const { data, error } = await supabase.from('price_reader_products').update({ title: refreshed.title, image_url: refreshed.imageUrl ?? null, shop_name: refreshed.shopName ?? null, provider: refreshed.provider, exchange_rate_vnd: refreshed.exchangeRateVnd, variants: refreshed.variants, promotions: refreshed.promotions, last_checked_at: refreshed.updatedAt, updated_at: refreshed.updatedAt }).eq('id', id).select('*').single();
  if (error || !data) throw new Error(error?.message ?? 'Không thể cập nhật sản phẩm.');
  const { error: snapshotError } = await supabase.from('price_reader_snapshots').insert({ product_id: id, payload: refreshed, captured_at: refreshed.updatedAt });
  if (snapshotError) throw new Error(snapshotError.message);
  return productFromRow(data as Record<string, any>);
}

export async function deleteTrackedPriceProduct(id: string): Promise<void> {
  if (!supabase) {
    const entry = [...memoryTracked.entries()].find(([, value]) => value.product.id === id);
    if (entry) memoryTracked.delete(entry[0]);
    return;
  }
  const { error } = await supabase.from('price_reader_products').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
