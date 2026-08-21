# Price Reader

The admin price reader accepts product URLs from Taobao, Tmall, 1688, Pinduoduo, JD and Xiaohongshu. It resolves the marketplace and product ID, then delegates live lookup to a configured server-side provider.

## Provider configuration

The app intentionally does not scrape HTML or show guessed prices. Set these server environment variables:

```env
PRICE_READER_PROVIDER_URL="https://your-approved-provider.example/quote"
PRICE_READER_PROVIDER_TOKEN=""
PRICE_READER_EXCHANGE_RATE_VND=3500
```

The API sends this request to the provider:

```json
{
  "url": "https://item.taobao.com/item.htm?id=123456789",
  "source": "taobao",
  "productId": "123456789"
}
```

The response can be either the product object or `{ "data": { ... } }` / `{ "product": { ... } }`:

```json
{
  "title": "Example product",
  "shopName": "Example shop",
  "imageUrl": "https://example.com/product.jpg",
  "variants": [{
    "id": "sku-1",
    "label": "Red / 20 cm",
    "priceCny": 39.9,
    "originalPriceCny": 49.9,
    "stock": 12,
    "skuAttributes": { "Color": "Red", "Size": "20 cm" }
  }],
  "promotions": [{
    "id": "coupon-1",
    "title": "Store coupon",
    "discountCny": 5,
    "finalPriceCny": 34.9,
    "endsAt": "2026-08-31T23:59:59+08:00"
  }]
}
```

Apply `supabase/migrations/0006_price_reader.sql` before using saved tracking. The saved record includes the latest variants/promotions and a snapshot row for every refresh.
