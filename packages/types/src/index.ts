import { z } from 'zod';

export const ShapeTypeSchema = z.enum([
  'cylinder', 'half-cylinder', 'organic', 'landmark', 'pattern', 'tower',
  'geometric', 'multi-panel', 'stackable', 'modular',
]);
export type ShapeType = z.infer<typeof ShapeTypeSchema>;

export const ProductColorSchema = z.object({
  id: z.string(), name: z.string(), hex: z.string(), priceDelta: z.number().default(0),
});
export type ProductColor = z.infer<typeof ProductColorSchema>;

export const ProductSchema = z.object({
  id: z.string(), slug: z.string(), sku: z.string(), name: z.string(), collection: z.string(),
  collectionSlug: z.string(), province: z.string(), category: z.string(), description: z.string(),
  story: z.string(), price: z.number().nonnegative(), colors: z.array(ProductColorSchema),
  defaultColorId: z.string(), dimensions: z.object({ width: z.number(), height: z.number(), depth: z.number() }),
  material: z.string(), printTime: z.string(), weight: z.number(), hardwareCompatibility: z.array(z.string()),
  featured: z.boolean(), published: z.boolean(), shape: ShapeTypeSchema,
  heroImage: z.string().optional(), gallery: z.array(z.string()).default([]).optional(), model3D: z.string().optional(),
  stockStatus: z.enum(['in-stock', 'made-to-order', 'unavailable']).default('made-to-order'),
});
export type Product = z.infer<typeof ProductSchema>;

export type Collection = {
  id: string; slug: string; name: string; province: string; description: string; story: string;
  coverImage: string; productIds: string[];
};

export const CartItemSchema = z.object({
  productId: z.string(), colorId: z.string(), base: z.enum(['core', 'e27', 'bambu-led-kit-001']),
  quantity: z.number().int().min(1).max(20),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const OrderInputSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100), email: z.string().trim().email(),
    phone: z.string().trim().min(6).max(30), address: z.string().trim().min(5).max(300),
    note: z.string().trim().max(1000).optional().default(''),
  }), items: z.array(CartItemSchema).min(1),
});
export type OrderInput = z.infer<typeof OrderInputSchema>;

export const OrderStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'COMPLETED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type Order = {
  id: string; orderNumber: string; createdAt: string; status: OrderStatus; customer: OrderInput['customer'];
  items: Array<CartItem & { productName: string; unitPrice: number; lineTotal: number; colorName: string }>;
  total: number;
};

export const MarketplaceSourceSchema = z.enum(['taobao', 'tmall', '1688', 'pinduoduo', 'jd', 'xiaohongshu', 'unknown']);
export type MarketplaceSource = z.infer<typeof MarketplaceSourceSchema>;

export const PriceReaderVariantSchema = z.object({
  id: z.string(),
  label: z.string(),
  priceCny: z.number().nonnegative(),
  originalPriceCny: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  skuAttributes: z.record(z.string()).default({}),
});
export type PriceReaderVariant = z.infer<typeof PriceReaderVariantSchema>;

export const PriceReaderPromotionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  discountCny: z.number().nonnegative().optional(),
  finalPriceCny: z.number().nonnegative().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  source: z.string().optional(),
});
export type PriceReaderPromotion = z.infer<typeof PriceReaderPromotionSchema>;

export const PriceReaderProductSchema = z.object({
  id: z.string(),
  source: MarketplaceSourceSchema,
  sourceLabel: z.string(),
  sourceProductId: z.string(),
  url: z.string().url(),
  title: z.string(),
  imageUrl: z.string().url().optional(),
  shopName: z.string().optional(),
  currency: z.literal('CNY').default('CNY'),
  exchangeRateVnd: z.number().positive(),
  variants: z.array(PriceReaderVariantSchema),
  promotions: z.array(PriceReaderPromotionSchema),
  updatedAt: z.string(),
  provider: z.string(),
});
export type PriceReaderProduct = z.infer<typeof PriceReaderProductSchema>;

export type ShapeDefinition = {
  type: ShapeType; source?: 'builtin' | 'svg' | 'png' | 'dxf' | 'obj' | 'stl' | 'glb' | 'custom';
  path?: string; scale?: number; width: number; height: number; depth?: number; extrusion?: number;
};

export type GeometryConfig = {
  shape: ShapeDefinition;
  shell: { wallThickness: number; topThickness: number; bottomThickness: number };
  pattern: { type: 'none' | 'voronoi' | 'hexagon' | 'wave' | 'grid' | 'organic' | 'lines' | 'dots' | 'custom'; density: number; openingSize: number; strength: number };
  hardware: 'E27' | 'BAMBU_LED_KIT_001';
  connector: { type: 'CORE_BAYONET'; lockAngle: number; clearance: number; diameter: number; height: number };
  printProfile: { printer: string; nozzleDiameter: number; minimumWall: number; minimumFeature: number; minimumGap: number; recommendedOverhang: number };
};

export type MeshData = { vertices: number[]; indices: number[]; normals?: number[]; metadata: { width: number; height: number; depth: number; wallThickness: number; shape: ShapeType } };
export type ValidationIssue = { level: 'safe' | 'warning' | 'error'; label: string; value: string; detail: string };
export type PrintabilityReport = { overall: 'SAFE' | 'WARNING' | 'ERROR'; issues: ValidationIssue[]; estimatedPrintTime: string; estimatedMaterialGrams: number };

export const DesignProjectSchema = z.object({
  version: z.number().int().positive(), id: z.string(), name: z.string(), productId: z.string().optional(),
  originalShape: z.record(z.unknown()), parameters: z.record(z.unknown()), generatedGeometry: z.record(z.unknown()),
  history: z.array(z.record(z.unknown())).default([]), updatedAt: z.string(),
});
export type DesignProject = z.infer<typeof DesignProjectSchema>;
export function createDesignProject(name: string, productId: string, parameters: Record<string, unknown>): DesignProject {
  return { version: 1, id: crypto.randomUUID(), name, productId, originalShape: {}, parameters, generatedGeometry: {}, history: [], updatedAt: new Date().toISOString() };
}
export function migrateDesignProject(input: unknown): DesignProject {
  const parsed = DesignProjectSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const legacy = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return { version: 1, id: typeof legacy.id === 'string' ? legacy.id : crypto.randomUUID(), name: typeof legacy.name === 'string' ? legacy.name : 'Untitled lamp', productId: typeof legacy.productId === 'string' ? legacy.productId : undefined, originalShape: (legacy.shape as Record<string, unknown>) ?? {}, parameters: (legacy.geometry as Record<string, unknown>) ?? {}, generatedGeometry: {}, history: [], updatedAt: new Date().toISOString() };
}

export const HARDWARE_SPECS = {
  E27: { socketDiameter: 42, socketHeight: 55, clearance: 1.2, wallThickness: 2, heatClearance: 12, cablePassage: 10, reference: 'Configurable baseline; verify the selected socket before manufacturing.' },
  BAMBU_LED_KIT_001: { moduleDiameter: 45, moduleHeight: 18, mountDiameter: 48, clearance: 0.6, heatClearance: 8, cablePassage: 8, reference: 'Adapter envelope; verify the purchased LED Kit 001 revision before manufacturing.' },
} as const;

export const PRINT_PROFILES = {
  BAMBU_A1_04: { printer: 'BAMBU_A1_04', nozzleDiameter: 0.4, minimumWall: 1.2, minimumFeature: 0.8, minimumGap: 0.8, recommendedLayerHeight: 0.2, recommendedOverhang: 55, bridgeLimit: 10, supportRecommendation: 'Use supports above 55° overhang.' },
} as const;

export const DEFAULT_GEOMETRY_CONFIG: GeometryConfig = {
  shape: { type: 'cylinder', source: 'builtin', width: 180, height: 220, depth: 180, extrusion: 220 },
  shell: { wallThickness: 1.6, topThickness: 2, bottomThickness: 3 },
  pattern: { type: 'wave', density: 0.45, openingSize: 4, strength: 0.35 },
  hardware: 'BAMBU_LED_KIT_001', connector: { type: 'CORE_BAYONET', lockAngle: 35, clearance: 0.35, diameter: 52, height: 8 },
  printProfile: PRINT_PROFILES.BAMBU_A1_04,
};
