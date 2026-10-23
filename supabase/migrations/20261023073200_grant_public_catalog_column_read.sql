-- Public catalog access is intentionally column-limited.
-- Do not grant table-wide SELECT: raw_payload, seller_name, SKU and detailed source data stay private.
GRANT SELECT (
  id,
  zzer_item_id,
  title,
  brand,
  category,
  condition_grade,
  selling_price_cny,
  photos,
  updated_at,
  auth_certificate_url
) ON TABLE public.products_zzer TO anon, authenticated;
