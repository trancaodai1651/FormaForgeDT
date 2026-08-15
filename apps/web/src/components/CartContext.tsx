import { createContext, useContext, useMemo, useState } from 'react';
import type { CartItem } from '@hometown/types';
import { enrichCart } from '../lib/cart';
import { useCatalog } from './CatalogContext';

type CartContextValue = { items: CartItem[]; lines: ReturnType<typeof enrichCart>; total: number; add: (item: CartItem) => void; remove: (productId: string, colorId: string, base: CartItem['base']) => void; updateQuantity: (item: CartItem, quantity: number) => void; clear: () => void };
const CartContext = createContext<CartContextValue | null>(null);
const key = (item: Pick<CartItem, 'productId' | 'colorId' | 'base'>) => `${item.productId}:${item.colorId}:${item.base}`;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { products } = useCatalog();
  const [items, setItems] = useState<CartItem[]>(() => { try { return JSON.parse(localStorage.getItem('hometown-cart') ?? '[]') as CartItem[]; } catch { return []; } });
  const save = (next: CartItem[]) => { setItems(next); localStorage.setItem('hometown-cart', JSON.stringify(next)); };
  const value = useMemo<CartContextValue>(() => { const lines = enrichCart(items, products); return { items, lines, total: lines.reduce((sum, line) => sum + line.lineTotal, 0), add: (item) => { const existing = items.find((candidate) => key(candidate) === key(item)); save(existing ? items.map((candidate) => key(candidate) === key(item) ? { ...candidate, quantity: Math.min(20, candidate.quantity + item.quantity) } : candidate) : [...items, item]); }, remove: (productId, colorId, base) => save(items.filter((item) => key(item) !== key({ productId, colorId, base }))), updateQuantity: (item, quantity) => quantity <= 0 ? save(items.filter((candidate) => key(candidate) !== key(item))) : save(items.map((candidate) => key(candidate) === key(item) ? { ...candidate, quantity: Math.min(20, quantity) } : candidate)), clear: () => save([]) }; }, [items, products]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() { const context = useContext(CartContext); if (!context) throw new Error('useCart must be used inside CartProvider'); return context; }
