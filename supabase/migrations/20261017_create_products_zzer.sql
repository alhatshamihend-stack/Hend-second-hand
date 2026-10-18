create extension if not exists pgcrypto;

create table if not exists public.products_zzer (
  id uuid primary key default gen_random_uuid(),
  zzer_item_id text not null unique,
  title text,
  brand text,
  condition_grade text check (condition_grade in ('S', 'A', 'B', 'C', 'D')),
  selling_price_cny numeric,
  auth_certificate_url text,
  photos jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.products_zzer enable row level security;

create policy "allow_anon_insert"
  on public.products_zzer
  for insert
  with check (true);

create policy "allow_public_read"
  on public.products_zzer
  for select
  using (true);

create index if not exists idx_products_zzer_updated_at
  on public.products_zzer (updated_at desc);

create index if not exists idx_products_zzer_zzer_item_id
  on public.products_zzer (zzer_item_id);
