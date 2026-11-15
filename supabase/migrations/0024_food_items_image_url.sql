-- Front-of-pack photo of products cached from Open Food Facts (remote URL,
-- images are CC BY-SA). Bundled catalogue foods keep using the app's own photos.
alter table public.food_items add column if not exists image_url text;
