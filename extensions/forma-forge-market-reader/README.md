# FormaForge Market Reader

Manifest V3 Chrome extension for reading visible prices on supported Chinese marketplaces and translating commerce text to Vietnamese.

## Install

1. Download and unzip `forma-forge-market-reader.zip`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped extension folder.

Chrome does not install a ZIP directly; it must be unzipped before using **Load unpacked**.

## Use

Click the extension icon to open the full-height Chrome side panel on the right. When a supported product tab opens, changes URL or becomes active, the panel automatically captures every SKU/variant without requiring a button click. Use **Đọc giá trang này** as a manual refresh when needed. Each product and variant keeps the original marketplace text together with its Vietnamese translation, plus current price, original price, attributes and stock when available. The side panel shows the lowest price, a CNY/VND conversion updated from the latest public reference rate and Vietnamese labels. Use **Dịch trang** to translate visible Chinese text; repeated labels are cached and unique texts are translated concurrently to reduce wait time.

Supported pages: Taobao, Tmall, 1688, JD, Pinduoduo and Xiaohongshu product pages.

## Buyer tools

- The page receives a small FormaForge VND overlay and inline VND labels next to detected CNY prices. The exchange rate is refreshed from the public reference endpoint and falls back to the last cached rate when offline.
- **Trợ lý nhắn tin** supports Trung → Việt, Việt → Trung, Trung → English and English → Trung. Translations use the same cache and custom endpoint configured in Options.
- **Báo giá PDF + ảnh từng phân loại** creates one PDF page per detected variant and renders the product/variant names, original text, CNY/VND price, stock, attributes and the exact image for that variant when the marketplace provides one. If a variant has no separate image, the page uses the product image and marks it as a shared product image.
- **Tải ZIP ảnh từng phân loại** downloads the product gallery and every detected variant image as separate files in one ZIP archive. Gallery images use the translated product title (`bo-ly-thuy-tinh.jpg`, `bo-ly-thuy-tinh-2.jpg`); variant images use their translated labels (`mau-do.jpg`). All names are normalized to lowercase ASCII without Vietnamese diacritics, and repeated labels receive a numeric suffix instead of overwriting an image.

The PDF and ZIP exporters fetch image bytes in the extension service worker, so marketplace CDN images do not depend on page CORS settings. If a marketplace blocks a particular CDN asset, the remaining available assets are still exported.

The extension reads the rendered page and embedded product data only. It does not access, export or transmit login cookies. Price results are a snapshot of data currently available in the marketplace page. The exchange rate is a daily reference rate and is cached for one hour with the last known value as offline fallback. The translation button uses the default translation endpoint in `background.js`; a compatible custom endpoint can be set from Options.

The Supabase project URL and public anon key are bundled at build time, so users do not need to enter connection keys in Options. The anon key is public by design; never bundle a service-role key. Sign up or sign in from the side panel, then use **Lưu sản phẩm** after reading a page to store it in the shared `price_reader_products` table under the signed-in Supabase user. The saved-products list is synchronized across browser profiles using the same account.
# FormaForge Market Reader

Chrome Manifest V3 extension hỗ trợ đọc giá, phân loại, khuyến mãi, tỷ giá CNY/VND, dịch nội dung và lưu sản phẩm vào Supabase theo user. Extension dùng JavaScript/HTML/CSS thuần để chạy ổn định trên trang thương mại.

## Cấu trúc

- `manifest.json`: quyền và entrypoint MV3.
- `content.js`: đọc DOM trang hiện tại và chèn UI/sidebar.
- `background.js`: message routing và network boundary.
- `auth.js`, `config.js`: session/public config.
- `popup.*`: popup/sidebar controls.
- `options.*`: cài đặt public endpoint.

Không commit `config.js` đã inject key thật. Gói tải cho người dùng được tạo bởi `scripts/build-market-reader.mjs`; key trong extension chỉ là anon key public.
