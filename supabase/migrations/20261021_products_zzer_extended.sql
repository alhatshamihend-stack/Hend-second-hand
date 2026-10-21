-- Make the extended ZZER columns available in both fresh and existing databases.
-- All additions are idempotent because production may already contain some of these columns.

ALTER TABLE public.products_zzer
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS original_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_price_cny numeric,
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sku text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS degree_ext text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS store_location text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS flaws jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seller_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS product_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;

CREATE INDEX IF NOT EXISTS idx_products_zzer_sku
  ON public.products_zzer (sku);
