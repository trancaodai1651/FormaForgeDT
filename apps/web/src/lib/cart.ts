import type { CartItem, Product } from '@hometown/types';

export const BASE_PRICES = { core: 0, e27: 180000, 'bambu-led-kit-001': 420000 } as const;
export type CartLine = CartItem & { product: Product; colorName: string; colorHex: string; unitPrice: number; lineTotal: number };

export function priceFor(product: Product, colorId: string, base: CartItem['base']) {
  const color = product.colors.find((item) => item.id === colorId) ?? product.colors[0];
  return product.price + (color?.priceDelta ?? 0) + BASE_PRICES[base];
}

export function enrichCart(items: CartItem[], products: Product[]): CartLine[] {
  return items.flatMap((item) => { const product = products.find((candidate) => candidate.id === item.productId); if (!product) return []; const color = product.colors.find((candidate) => candidate.id === item.colorId) ?? product.colors[0]; const unitPrice = priceFor(product, item.colorId, item.base); return [{ ...item, product, colorName: color.name, colorHex: color.hex, unitPrice, lineTotal: unitPrice * item.quantity }]; });
}

export const formatVnd = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
