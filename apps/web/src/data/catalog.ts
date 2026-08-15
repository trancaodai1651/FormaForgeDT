import type { Collection, Product, ProductColor } from '@hometown/types';

export const colors: ProductColor[] = [
  { id: 'porcelain', name: 'Porcelain', hex: '#e8e5db', priceDelta: 0 },
  { id: 'obsidian', name: 'Obsidian', hex: '#17181a', priceDelta: 0 },
  { id: 'sand', name: 'Sand', hex: '#c7a986', priceDelta: 80000 },
  { id: 'lacquer-red', name: 'Lacquer red', hex: '#9b3a31', priceDelta: 80000 },
  { id: 'deep-sea', name: 'Deep sea', hex: '#315b67', priceDelta: 80000 },
  { id: 'jade', name: 'Jade', hex: '#607c6d', priceDelta: 80000 },
];

const defaultHardware = ['CORE_BAYONET', 'BAMBU_LED_KIT_001', 'E27'];

export const products: Product[] = [
  { id: 'py01', slug: 'ganh-da-dia', sku: 'PY01', name: 'Gành Đá Đĩa', collection: 'Phú Yên', collectionSlug: 'phu-yen', province: 'Phú Yên', category: 'Landmark silhouette', description: 'Nhịp điệu địa tầng ven biển, chuyển hóa thành một vệt sáng có thể chạm vào.', story: 'Những khối đá tròn xếp lớp ở miền biển Phú Yên trở thành một lamp shade nhịp nhàng, thoáng và giàu bóng đổ.', price: 2890000, colors, defaultColorId: 'porcelain', dimensions: { width: 180, height: 220, depth: 180 }, material: 'PLA matte', printTime: '5h 42m', weight: 420, hardwareCompatibility: defaultHardware, featured: true, published: true, shape: 'landmark', stockStatus: 'made-to-order' },
  { id: 'py02', slug: 'thap-nghinh-phong', sku: 'PY02', name: 'Tháp Nghinh Phong', collection: 'Phú Yên', collectionSlug: 'phu-yen', province: 'Phú Yên', category: 'Vertical tower', description: 'Hai nhịp tháp hướng ra gió biển, dựng thành ánh sáng ấm cho những buổi tối chậm.', story: 'Lấy cảm hứng từ đường nét đặc trưng của Tháp Nghinh Phong, shade này tạo ra một silhouette kiến trúc có độ hiện diện rõ ràng.', price: 3190000, colors, defaultColorId: 'sand', dimensions: { width: 160, height: 270, depth: 160 }, material: 'PLA matte', printTime: '6h 18m', weight: 510, hardwareCompatibility: defaultHardware, featured: true, published: true, shape: 'tower', stockStatus: 'made-to-order' },
  { id: 'py03', slug: 'coastal-pattern', sku: 'PY03', name: 'Coastal Pattern', collection: 'Phú Yên', collectionSlug: 'phu-yen', province: 'Phú Yên', category: 'Pattern lamp', description: 'Một bề mặt gợn sóng để ánh sáng thở qua, như mặt biển nhìn từ xa.', story: 'Không mô tả một địa danh cụ thể; Coastal Pattern giữ lại cảm giác của đường bờ — mềm, lặp và luôn chuyển động.', price: 2490000, colors, defaultColorId: 'deep-sea', dimensions: { width: 190, height: 200, depth: 190 }, material: 'PETG translucent', printTime: '4h 56m', weight: 380, hardwareCompatibility: defaultHardware, featured: true, published: true, shape: 'pattern', stockStatus: 'in-stock' },
  { id: 'hn01', slug: 'turtle-tower', sku: 'HN01', name: 'Turtle Tower', collection: 'Hà Nội', collectionSlug: 'ha-noi', province: 'Hà Nội', category: 'Landmark silhouette', description: 'Một nhịp sáng nhỏ giữa mặt hồ tưởng niệm.', story: 'Hà Nội hiện lên bằng một đường viền vừa đủ, không minh họa nguyên trạng mà gợi lại cảm giác thân thuộc.', price: 2990000, colors, defaultColorId: 'jade', dimensions: { width: 175, height: 225, depth: 175 }, material: 'PLA matte', printTime: '5h 34m', weight: 410, hardwareCompatibility: defaultHardware, featured: false, published: true, shape: 'landmark', stockStatus: 'made-to-order' },
  { id: 'hcm01', slug: 'urban-pulse', sku: 'HCM01', name: 'Urban Pulse', collection: 'TP.HCM', collectionSlug: 'tp-hcm', province: 'TP.HCM', category: 'Geometric lamp', description: 'Nhịp điệu đô thị nén lại thành một khối sáng gọn và sắc.', story: 'Một lamp shade modular cho những căn hộ thành phố — gọn, sáng, có nhịp.', price: 2690000, colors, defaultColorId: 'obsidian', dimensions: { width: 170, height: 210, depth: 170 }, material: 'PETG matte', printTime: '5h 08m', weight: 395, hardwareCompatibility: defaultHardware, featured: false, published: true, shape: 'geometric', stockStatus: 'made-to-order' },
];

export const collections: Collection[] = [
  { id: 'phu-yen', slug: 'phu-yen', name: 'Phú Yên', province: 'Phú Yên', description: 'Đá, gió và đường chân trời miền Trung.', story: 'Quê hương không chỉ là nơi bạn sinh ra. Đó là nơi bạn nhớ — và chúng tôi biến ký ức ấy thành ánh sáng.', coverImage: 'coast', productIds: ['py01', 'py02', 'py03'] },
  { id: 'ha-noi', slug: 'ha-noi', name: 'Hà Nội', province: 'Hà Nội', description: 'Một nhịp sáng nhỏ giữa những lớp thời gian.', story: 'Từ mặt hồ đến mái ngói, Hà Nội luôn có cách ở lại trong trí nhớ bằng những đường nét rất riêng.', coverImage: 'city', productIds: ['hn01'] },
  { id: 'tp-hcm', slug: 'tp-hcm', name: 'TP.HCM', province: 'TP.HCM', description: 'Đô thị, chuyển động và những đêm không tắt.', story: 'Thành phố được nhìn như một trường ánh sáng — nhanh, dày, nhưng vẫn có những khoảng thở.', coverImage: 'urban', productIds: ['hcm01'] },
  { id: 'future', slug: 'future-heritage', name: 'Future Heritage', province: 'Đang mở rộng', description: 'Những vùng đất tiếp theo đang được dựng hình.', story: 'Kiến trúc dữ liệu đã sẵn sàng cho hàng trăm shade mới và những bộ sưu tập tiếp theo.', coverImage: 'future', productIds: [] },
];

export function getProduct(slugOrId: string) { return products.find((product) => product.id === slugOrId || product.slug === slugOrId); }
export function getCollection(slug: string) { return collections.find((collection) => collection.slug === slug); }
