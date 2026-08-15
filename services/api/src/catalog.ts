import type { Product } from '@hometown/types';
import { supabase } from './db.js';

const colors = [{ id: 'porcelain', name: 'Porcelain', hex: '#e8e5db', priceDelta: 0 }, { id: 'obsidian', name: 'Obsidian', hex: '#17181a', priceDelta: 0 }, { id: 'sand', name: 'Sand', hex: '#c7a986', priceDelta: 80000 }, { id: 'lacquer-red', name: 'Lacquer red', hex: '#9b3a31', priceDelta: 80000 }, { id: 'deep-sea', name: 'Deep sea', hex: '#315b67', priceDelta: 80000 }, { id: 'jade', name: 'Jade', hex: '#607c6d', priceDelta: 80000 }];
const hardwareCompatibility = ['CORE_BAYONET', 'BAMBU_LED_KIT_001', 'E27'];
export const catalog: Product[] = [
  { id: 'py01', slug: 'ganh-da-dia', sku: 'PY01', name: 'Gành Đá Đĩa', collection: 'Phú Yên', collectionSlug: 'phu-yen', province: 'Phú Yên', category: 'Landmark silhouette', description: 'Nhịp điệu địa tầng ven biển, chuyển hóa thành một vệt sáng có thể chạm vào.', story: 'Những khối đá tròn xếp lớp ở miền biển Phú Yên trở thành một lamp shade nhịp nhàng, thoáng và giàu bóng đổ.', price: 2890000, colors, defaultColorId: 'porcelain', dimensions: { width: 180, height: 220, depth: 180 }, material: 'PLA matte', printTime: '5h 42m', weight: 420, hardwareCompatibility, featured: true, published: true, shape: 'landmark', stockStatus: 'made-to-order' },
  { id: 'py02', slug: 'thap-nghinh-phong', sku: 'PY02', name: 'Tháp Nghinh Phong', collection: 'Phú Yên', collectionSlug: 'phu-yen', province: 'Phú Yên', category: 'Vertical tower', description: 'Hai nhịp tháp hướng ra gió biển, dựng thành ánh sáng ấm cho những buổi tối chậm.', story: 'Lấy cảm hứng từ đường nét đặc trưng của Tháp Nghinh Phong, shade này tạo ra một silhouette kiến trúc có độ hiện diện rõ ràng.', price: 3190000, colors, defaultColorId: 'sand', dimensions: { width: 160, height: 270, depth: 160 }, material: 'PLA matte', printTime: '6h 18m', weight: 510, hardwareCompatibility, featured: true, published: true, shape: 'tower', stockStatus: 'made-to-order' },
  { id: 'py03', slug: 'coastal-pattern', sku: 'PY03', name: 'Coastal Pattern', collection: 'Phú Yên', collectionSlug: 'phu-yen', province: 'Phú Yên', category: 'Pattern lamp', description: 'Một bề mặt gợn sóng để ánh sáng thở qua, như mặt biển nhìn từ xa.', story: 'Không mô tả một địa danh cụ thể; Coastal Pattern giữ lại cảm giác của đường bờ — mềm, lặp và luôn chuyển động.', price: 2490000, colors, defaultColorId: 'deep-sea', dimensions: { width: 190, height: 200, depth: 190 }, material: 'PETG translucent', printTime: '4h 56m', weight: 380, hardwareCompatibility, featured: true, published: true, shape: 'pattern', stockStatus: 'in-stock' },
  { id: 'hn01', slug: 'turtle-tower', sku: 'HN01', name: 'Turtle Tower', collection: 'Hà Nội', collectionSlug: 'ha-noi', province: 'Hà Nội', category: 'Landmark silhouette', description: 'Một nhịp sáng nhỏ giữa mặt hồ tưởng niệm.', story: 'Hà Nội hiện lên bằng một đường viền vừa đủ, không minh họa nguyên trạng mà gợi lại cảm giác thân thuộc.', price: 2990000, colors, defaultColorId: 'jade', dimensions: { width: 175, height: 225, depth: 175 }, material: 'PLA matte', printTime: '5h 34m', weight: 410, hardwareCompatibility, featured: false, published: true, shape: 'landmark', stockStatus: 'made-to-order' },
  { id: 'hcm01', slug: 'urban-pulse', sku: 'HCM01', name: 'Urban Pulse', collection: 'TP.HCM', collectionSlug: 'tp-hcm', province: 'TP.HCM', category: 'Geometric lamp', description: 'Nhịp điệu đô thị nén lại thành một khối sáng gọn và sắc.', story: 'Một lamp shade modular cho những căn hộ thành phố — gọn, sáng, có nhịp.', price: 2690000, colors, defaultColorId: 'obsidian', dimensions: { width: 170, height: 210, depth: 170 }, material: 'PETG matte', printTime: '5h 08m', weight: 395, hardwareCompatibility, featured: false, published: true, shape: 'geometric', stockStatus: 'made-to-order' },
];

export const basePrices = { core: 0, e27: 180000, 'bambu-led-kit-001': 420000 } as const;
export function priceFor(product: Product, colorId: string, base: keyof typeof basePrices) { const color = product.colors.find((item) => item.id === colorId) ?? product.colors[0]; return product.price + (color?.priceDelta ?? 0) + basePrices[base]; }

type CatalogCache = { expiresAt: number; products: Product[] };
let catalogCache: CatalogCache | null = null;

function numberValue(value: unknown, fallback = 0) { const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN; return Number.isFinite(numeric) ? numeric : fallback; }
function recordValue(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export async function getCatalog(): Promise<Product[]> {
  if (!supabase) return catalog;
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.products;

  const [productResult, collectionResult, provinceResult, colorResult, productColorResult, hardwareResult, productHardwareResult, materialResult] = await Promise.all([
    supabase.from('products').select('*').eq('published', true).order('created_at', { ascending: true }),
    supabase.from('collections').select('id, slug, name, province_id'),
    supabase.from('provinces').select('id, name'),
    supabase.from('colors').select('id, slug, name, hex, price_delta'),
    supabase.from('product_colors').select('product_id, color_id'),
    supabase.from('hardware').select('id, code'),
    supabase.from('product_hardware').select('product_id, hardware_id'),
    supabase.from('materials').select('id, name'),
  ]);
  const firstError = [productResult, collectionResult, provinceResult, colorResult, productColorResult, hardwareResult, productHardwareResult, materialResult].find((result) => result.error)?.error;
  if (firstError) throw new Error(`Không thể tải catalog Supabase: ${firstError.message}`);

  const collections = new Map((collectionResult.data ?? []).map((row) => [row.id, row]));
  const provinces = new Map((provinceResult.data ?? []).map((row) => [row.id, row.name]));
  const colorsById = new Map((colorResult.data ?? []).map((row) => [row.id, { id: row.slug, name: row.name, hex: row.hex, priceDelta: row.price_delta }]));
  const hardwareById = new Map((hardwareResult.data ?? []).map((row) => [row.id, row.code]));
  const materialById = new Map((materialResult.data ?? []).map((row) => [row.id, row.name]));
  const productColors = new Map<string, Product['colors']>();
  for (const link of productColorResult.data ?? []) {
    const color = colorsById.get(link.color_id);
    if (color) productColors.set(link.product_id, [...(productColors.get(link.product_id) ?? []), color]);
  }
  const productHardware = new Map<string, string[]>();
  for (const link of productHardwareResult.data ?? []) {
    const code = hardwareById.get(link.hardware_id);
    if (code) productHardware.set(link.product_id, [...(productHardware.get(link.product_id) ?? []), code]);
  }

  const products = (productResult.data ?? []).map((row) => {
    const collection = collections.get(row.collection_id);
    const dimensions = recordValue(row.dimensions);
    const productColorsForRow = productColors.get(row.id) ?? colors;
    return {
      id: String(row.sku).toLowerCase(), slug: row.slug, sku: row.sku, name: row.name,
      collection: collection?.name ?? 'Hometown collection', collectionSlug: collection?.slug ?? 'hometown',
      province: provinces.get(row.province_id) ?? collection?.name ?? 'Vietnam', category: row.category,
      description: row.description ?? '', story: row.story ?? '', price: numberValue(row.price), colors: productColorsForRow,
      defaultColorId: productColorsForRow[0]?.id ?? 'porcelain', dimensions: { width: numberValue(dimensions.width), height: numberValue(dimensions.height), depth: numberValue(dimensions.depth) },
      material: materialById.get(row.material_id) ?? 'PLA matte', printTime: row.print_time ?? '', weight: numberValue(row.weight),
      hardwareCompatibility: productHardware.get(row.id) ?? hardwareCompatibility, featured: Boolean(row.featured), published: Boolean(row.published),
      heroImage: row.hero_image ?? undefined, gallery: row.gallery ?? [], model3D: row.model_3d ?? undefined,
      stockStatus: row.stock_status === 'in-stock' || row.stock_status === 'unavailable' ? row.stock_status : 'made-to-order',
      shape: row.shape ?? 'modular',
    } as Product;
  });
  catalogCache = { products: products.length ? products : catalog, expiresAt: Date.now() + 30_000 };
  return catalogCache.products;
}
