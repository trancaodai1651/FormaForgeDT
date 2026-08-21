# FormaForge Market Reader

Manifest V3 Chrome extension for reading price information visible on supported China marketplace pages and translating commerce text to Vietnamese.

## Install

1. Download and unzip `forma-forge-market-reader.zip`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped extension folder.

Chrome does not install a ZIP directly; it must be unzipped before using **Load unpacked**.

## Supported pages

Taobao, Tmall, 1688, JD, Pinduoduo and Xiaohongshu product pages.

The extension reads the rendered page only. It does not access, export or transmit login cookies. Price results are a snapshot of data currently rendered by the marketplace page. The translation button uses the default translation endpoint in `background.js`; a compatible custom endpoint can be set from Options.

The Supabase project URL and public anon key are bundled at build time, so users do not need to enter connection keys in Options. The anon key is public by design; never bundle a service-role key. Sign up or sign in from the popup, then use **Lưu sản phẩm** after reading a page to store it in the shared `price_reader_products` table under the signed-in Supabase user. The popup list is then synchronized across browser profiles using the same account.
