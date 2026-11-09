-- Foods that come from the FatSecret Platform API (search + barcode).
-- They are cached in the shared food_items catalog by the `food-search`
-- Edge Function (service role), so meal_entries.food_id keeps its FK and the
-- app can resolve any logged food, on any device, with a plain select.
alter table public.food_items
  add column if not exists source text not null default 'fitlab',
  add column if not exists brand text,
  add column if not exists barcode text,
  add column if not exists fetched_at timestamptz;

create index if not exists food_items_barcode_idx on public.food_items (barcode) where barcode is not null;
