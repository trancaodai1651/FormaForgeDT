import type { CarModel } from './carGeometry';

export const models: CarModel[] = [
  { id: 'mini-pickup', page: 5, en: 'Mini pickup', vi: 'Xe bán tải mini', kind: 'tray', cab: '#1686d7', body: '#1686d7', wheels: 4, beds: 1, partCount: 12, category: 'Cargo' },
  { id: 'long-bed', page: 6, en: 'Long-bed truck', vi: 'Xe thùng dài', kind: 'tray', cab: '#1686d7', body: '#1686d7', wheels: 4, beds: 2, partCount: 14, category: 'Cargo' },
  { id: 'multi-bay', page: 7, en: 'Multi-bay carrier', vi: 'Xe chở hàng nhiều khoang', kind: 'tray', cab: '#1686d7', body: '#1686d7', wheels: 6, beds: 3, partCount: 20, category: 'Cargo' },
  { id: 'tanker', page: 8, en: 'Water tanker', vi: 'Xe bồn', kind: 'tanker', cab: '#ee304b', body: '#c7c8cb', wheels: 4, partCount: 12, category: 'Service' },
  { id: 'cage-truck', page: 9, en: 'Cage truck', vi: 'Xe tải lồng', kind: 'cage', cab: '#1686d7', body: '#9ba4ad', wheels: 4, partCount: 12, category: 'Cargo' },
  { id: 'recycling', page: 10, en: 'Recycling truck', vi: 'Xe thu gom tái chế', kind: 'recycle', cab: '#1caa4b', body: '#169a43', wheels: 4, partCount: 13, category: 'Service' },
  { id: 'crate-truck', page: 11, en: 'Crate carrier', vi: 'Xe lu chở kiện hàng', kind: 'crate', cab: '#1686d7', body: '#1686d7', wheels: 4, partCount: 17, category: 'Cargo' },
  { id: 'yellow-car', page: 12, en: 'Yellow city car', vi: 'Xe đô thị màu vàng', kind: 'sedan', cab: '#f3cc14', body: '#f3cc14', wheels: 4, partCount: 12, category: 'Road' },
  { id: 'mobile-crane', page: 13, en: 'Mobile crane', vi: 'Xe cẩu', kind: 'crane', cab: '#ed263d', body: '#f1c90d', wheels: 4, partCount: 15, category: 'Construction' },
  { id: 'front-loader', page: 14, en: 'Front loader', vi: 'Xe xúc lật', kind: 'loader', cab: '#ed263d', body: '#f1c90d', wheels: 4, partCount: 16, category: 'Construction' },
  { id: 'hook-truck', page: 15, en: 'Hook lift truck', vi: 'Xe nâng móc', kind: 'hook', cab: '#ed263d', body: '#f1c90d', wheels: 4, partCount: 15, category: 'Construction' },
  { id: 'fire-engine', page: 16, en: 'Fire engine', vi: 'Xe cứu hỏa', kind: 'fire', cab: '#1686d7', body: '#db2036', wheels: 4, partCount: 15, category: 'Service' },
  { id: 'mixer', page: 17, en: 'Cement mixer', vi: 'Xe trộn bê tông', kind: 'mixer', cab: '#ed263d', body: '#f1c90d', wheels: 4, partCount: 14, category: 'Construction' },
  { id: 'sport-coupe', page: 18, en: 'SUV with spare wheel', vi: 'Xe SUV có bánh dự phòng', kind: 'sport', cab: '#ed263d', body: '#ed263d', wheels: 4, partCount: 14, category: 'Road' },
  { id: 'utility-pickup', page: 19, en: 'Utility pickup', vi: 'Xe bán tải tiện ích', kind: 'pickup', cab: '#aeb4bc', body: '#aeb4bc', wheels: 4, partCount: 12, category: 'Cargo' },
  { id: 'dump-truck', page: 20, en: 'Dump truck', vi: 'Xe ben', kind: 'dump', cab: '#1da94d', body: '#1da94d', wheels: 4, partCount: 12, category: 'Construction' },
  { id: 'delivery-van', page: 21, en: 'Delivery van', vi: 'Xe van giao hàng', kind: 'van', cab: '#aeb4bc', body: '#aeb4bc', wheels: 4, partCount: 12, category: 'Service' },
];
