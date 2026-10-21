# ZZER product data pipeline

The **standalone TypeScript scraper is the primary ingestion path**. It fetches exactly one ZZER product-detail API response for the product ID provided by the operator and sends that product to Supabase.

## Capture one product

1. Open the intended product in ZZER and identify its product ID.
2. Create a local `.env` from `.env.example`.
3. Set:
   - `ZZER_AUTH_TOKEN`: your own valid ZZER session token.
   - `SUPABASE_URL`: the URL of the intended Supabase project.
   - `SUPABASE_KEY`: a public anon/publishable key accepted by the Edge Function. Never put a Supabase service-role/secret key in a browser extension or commit it to Git.
4. Install dependencies with `bun install`.
5. Run the scraper with the exact product ID:

   ```bash
   bun run zzer:scrape -- 2585638151251599365
   ```

   Replace the example ID with the product you intentionally selected. The scraper does not crawl listing pages or follow similar-product recommendations.

## What is stored

- Main columns: product ID, title, brand, normalized grade, price, SKU, category, original price, discount, store location, seller name, and product photos.
- `product_details` (JSONB): raw detail object, product attributes, defect details, image variants, authenticity questions/report and related metadata.
- `raw_payload` (JSONB): the complete API response, retained so field mappings can be checked against the actual response instead of guessed key names.

A repeat capture uses `zzer_item_id` as the conflict key, so it updates the same product row rather than creating duplicates. The Edge Function preserves the original `created_at` value when updating an existing row.

## Tests

Run the current scraper tests:

```bash
bun run test:zzer
```

The tests use mocked API responses and do not need a live ZZER token. A successful test run does **not** confirm that the current real-world ZZER token or Supabase deployment is valid; check those separately.

## Supabase schema

The idempotent migration `supabase/migrations/20261021_products_zzer_extended.sql` adds missing extended columns for fresh or older databases. Apply repository migrations to the same Supabase project that the scraper points to. Some columns may already exist in a database that was updated directly.

## Chrome extension status

The `extension/` directory contains an older connector experiment. Its `track` request is an analytics event, not a trustworthy full product-detail response, so the extension no longer automatically uploads that event to Supabase. Do not use it as the production capture path until an explicit user-initiated “Save this product” flow is implemented and tested.
