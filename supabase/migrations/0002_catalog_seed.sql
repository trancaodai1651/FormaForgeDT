-- Hometown Modular Lamp / production catalog seed
-- Adds the first catalog records without replacing existing orders or assets.

insert into public.collections (id, slug, name, province_id, description, story, cover_image)
select '10000000-0000-0000-0000-000000000001'::uuid, 'phu-yen', 'Phú Yên', p.id,
  'Đá, gió và đường chân trời miền Trung.',
  'Quê hương không chỉ là nơi bạn sinh ra. Đó là nơi bạn nhớ — và chúng tôi biến ký ức ấy thành ánh sáng.',
  'coast'
from public.provinces p where p.name = 'Phú Yên'
on conflict (slug) do update set name = excluded.name, province_id = excluded.province_id, description = excluded.description, story = excluded.story, cover_image = excluded.cover_image;

insert into public.collections (id, slug, name, province_id, description, story, cover_image)
select '10000000-0000-0000-0000-000000000002'::uuid, 'ha-noi', 'Hà Nội', p.id,
  'Một nhịp sáng nhỏ giữa những lớp thời gian.',
  'Từ mặt hồ đến mái ngói, Hà Nội luôn có cách ở lại trong trí nhớ bằng những đường nét rất riêng.',
  'city'
from public.provinces p where p.name = 'Hà Nội'
on conflict (slug) do update set name = excluded.name, province_id = excluded.province_id, description = excluded.description, story = excluded.story, cover_image = excluded.cover_image;

insert into public.collections (id, slug, name, province_id, description, story, cover_image)
select '10000000-0000-0000-0000-000000000003'::uuid, 'tp-hcm', 'TP.HCM', p.id,
  'Đô thị, chuyển động và những đêm không tắt.',
  'Thành phố được nhìn như một trường ánh sáng — nhanh, dày, nhưng vẫn có những khoảng thở.',
  'urban'
from public.provinces p where p.name = 'TP.HCM'
on conflict (slug) do update set name = excluded.name, province_id = excluded.province_id, description = excluded.description, story = excluded.story, cover_image = excluded.cover_image;

insert into public.products (id, slug, sku, name, description, story, category, collection_id, province_id, price, dimensions, weight, print_time, shape, featured, published, stock_status, material_id)
select '20000000-0000-0000-0000-000000000001'::uuid, 'ganh-da-dia', 'PY01', 'Gành Đá Đĩa',
  'Nhịp điệu địa tầng ven biển, chuyển hóa thành một vệt sáng có thể chạm vào.',
  'Những khối đá tròn xếp lớp ở miền biển Phú Yên trở thành một lamp shade nhịp nhàng, thoáng và giàu bóng đổ.',
  'Landmark silhouette', c.id, p.id, 2890000, '{"width":180,"height":220,"depth":180}', 420, '5h 42m', 'landmark', true, true, 'made-to-order', m.id
from public.collections c join public.provinces p on p.name = 'Phú Yên' join public.materials m on m.slug = 'pla-matte' where c.slug = 'phu-yen'
on conflict (sku) do update set slug = excluded.slug, name = excluded.name, description = excluded.description, story = excluded.story, category = excluded.category, collection_id = excluded.collection_id, province_id = excluded.province_id, price = excluded.price, dimensions = excluded.dimensions, weight = excluded.weight, print_time = excluded.print_time, shape = excluded.shape, featured = excluded.featured, published = excluded.published, stock_status = excluded.stock_status, material_id = excluded.material_id, updated_at = now();

insert into public.products (id, slug, sku, name, description, story, category, collection_id, province_id, price, dimensions, weight, print_time, shape, featured, published, stock_status, material_id)
select '20000000-0000-0000-0000-000000000002'::uuid, 'thap-nghinh-phong', 'PY02', 'Tháp Nghinh Phong',
  'Hai nhịp tháp hướng ra gió biển, dựng thành ánh sáng ấm cho những buổi tối chậm.',
  'Lấy cảm hứng từ đường nét đặc trưng của Tháp Nghinh Phong, shade này tạo ra một silhouette kiến trúc có độ hiện diện rõ ràng.',
  'Vertical tower', c.id, p.id, 3190000, '{"width":160,"height":270,"depth":160}', 510, '6h 18m', 'tower', true, true, 'made-to-order', m.id
from public.collections c join public.provinces p on p.name = 'Phú Yên' join public.materials m on m.slug = 'pla-matte' where c.slug = 'phu-yen'
on conflict (sku) do update set slug = excluded.slug, name = excluded.name, description = excluded.description, story = excluded.story, category = excluded.category, collection_id = excluded.collection_id, province_id = excluded.province_id, price = excluded.price, dimensions = excluded.dimensions, weight = excluded.weight, print_time = excluded.print_time, shape = excluded.shape, featured = excluded.featured, published = excluded.published, stock_status = excluded.stock_status, material_id = excluded.material_id, updated_at = now();

insert into public.products (id, slug, sku, name, description, story, category, collection_id, province_id, price, dimensions, weight, print_time, shape, featured, published, stock_status, material_id)
select '20000000-0000-0000-0000-000000000003'::uuid, 'coastal-pattern', 'PY03', 'Coastal Pattern',
  'Một bề mặt gợn sóng để ánh sáng thở qua, như mặt biển nhìn từ xa.',
  'Không mô tả một địa danh cụ thể; Coastal Pattern giữ lại cảm giác của đường bờ — mềm, lặp và luôn chuyển động.',
  'Pattern lamp', c.id, p.id, 2490000, '{"width":190,"height":200,"depth":190}', 380, '4h 56m', 'pattern', true, true, 'in-stock', m.id
from public.collections c join public.provinces p on p.name = 'Phú Yên' join public.materials m on m.slug = 'petg-translucent' where c.slug = 'phu-yen'
on conflict (sku) do update set slug = excluded.slug, name = excluded.name, description = excluded.description, story = excluded.story, category = excluded.category, collection_id = excluded.collection_id, province_id = excluded.province_id, price = excluded.price, dimensions = excluded.dimensions, weight = excluded.weight, print_time = excluded.print_time, shape = excluded.shape, featured = excluded.featured, published = excluded.published, stock_status = excluded.stock_status, material_id = excluded.material_id, updated_at = now();

insert into public.products (id, slug, sku, name, description, story, category, collection_id, province_id, price, dimensions, weight, print_time, shape, featured, published, stock_status, material_id)
select '20000000-0000-0000-0000-000000000004'::uuid, 'turtle-tower', 'HN01', 'Turtle Tower',
  'Một nhịp sáng nhỏ giữa mặt hồ tưởng niệm.',
  'Hà Nội hiện lên bằng một đường viền vừa đủ, không minh họa nguyên trạng mà gợi lại cảm giác thân thuộc.',
  'Landmark silhouette', c.id, p.id, 2990000, '{"width":175,"height":225,"depth":175}', 410, '5h 34m', 'landmark', false, true, 'made-to-order', m.id
from public.collections c join public.provinces p on p.name = 'Hà Nội' join public.materials m on m.slug = 'pla-matte' where c.slug = 'ha-noi'
on conflict (sku) do update set slug = excluded.slug, name = excluded.name, description = excluded.description, story = excluded.story, category = excluded.category, collection_id = excluded.collection_id, province_id = excluded.province_id, price = excluded.price, dimensions = excluded.dimensions, weight = excluded.weight, print_time = excluded.print_time, shape = excluded.shape, featured = excluded.featured, published = excluded.published, stock_status = excluded.stock_status, material_id = excluded.material_id, updated_at = now();

insert into public.products (id, slug, sku, name, description, story, category, collection_id, province_id, price, dimensions, weight, print_time, shape, featured, published, stock_status, material_id)
select '20000000-0000-0000-0000-000000000005'::uuid, 'urban-pulse', 'HCM01', 'Urban Pulse',
  'Nhịp điệu đô thị nén lại thành một khối sáng gọn và sắc.',
  'Một lamp shade modular cho những căn hộ thành phố — gọn, sáng, có nhịp.',
  'Geometric lamp', c.id, p.id, 2690000, '{"width":170,"height":210,"depth":170}', 395, '5h 08m', 'geometric', false, true, 'made-to-order', m.id
from public.collections c join public.provinces p on p.name = 'TP.HCM' join public.materials m on m.slug = 'petg-translucent' where c.slug = 'tp-hcm'
on conflict (sku) do update set slug = excluded.slug, name = excluded.name, description = excluded.description, story = excluded.story, category = excluded.category, collection_id = excluded.collection_id, province_id = excluded.province_id, price = excluded.price, dimensions = excluded.dimensions, weight = excluded.weight, print_time = excluded.print_time, shape = excluded.shape, featured = excluded.featured, published = excluded.published, stock_status = excluded.stock_status, material_id = excluded.material_id, updated_at = now();

insert into public.product_colors (product_id, color_id)
select p.id, c.id from public.products p cross join public.colors c where p.sku in ('PY01', 'PY02', 'PY03', 'HN01', 'HCM01')
on conflict do nothing;

insert into public.product_hardware (product_id, hardware_id)
select p.id, h.id from public.products p cross join public.hardware h where p.sku in ('PY01', 'PY02', 'PY03', 'HN01', 'HCM01')
on conflict do nothing;
