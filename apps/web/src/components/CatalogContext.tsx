import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Collection, Product } from '@hometown/types';
import { collections as fallbackCollections, products as fallbackProducts } from '../data/catalog';
import { apiConfigured, getProducts } from '../lib/api';

type CatalogContextValue = { products: Product[]; collections: Collection[]; loading: boolean; getProduct: (slugOrId: string) => Product | undefined; getCollection: (slug: string) => Collection | undefined };
const CatalogContext = createContext<CatalogContextValue | null>(null);

function buildCollections(products: Product[]) {
  const map = new Map(fallbackCollections.map((collection) => [collection.slug, { ...collection, productIds: [] as string[] }]));
  for (const product of products) {
    const existing = map.get(product.collectionSlug);
    if (existing) existing.productIds.push(product.id);
    else map.set(product.collectionSlug, { id: product.collectionSlug, slug: product.collectionSlug, name: product.collection, province: product.province, description: '', story: '', coverImage: '', productIds: [product.id] });
  }
  return [...map.values()];
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState(fallbackProducts); const [loading, setLoading] = useState(apiConfigured);
  useEffect(() => { if (!apiConfigured) return; let active = true; getProducts().then((nextProducts) => { if (active && nextProducts.length) { const nextCollections = buildCollections(nextProducts); fallbackProducts.splice(0, fallbackProducts.length, ...nextProducts); fallbackCollections.splice(0, fallbackCollections.length, ...nextCollections); setProducts(nextProducts); } }).catch((error) => console.warn('[catalog] using local fallback:', error)).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const collections = useMemo(() => buildCollections(products), [products]);
  const value = useMemo<CatalogContextValue>(() => ({ products, collections, loading, getProduct: (slugOrId) => products.find((product) => product.id === slugOrId || product.slug === slugOrId), getCollection: (slug) => collections.find((collection) => collection.slug === slug) }), [collections, loading, products]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() { const context = useContext(CatalogContext); if (!context) throw new Error('useCatalog must be used inside CatalogProvider'); return context; }
