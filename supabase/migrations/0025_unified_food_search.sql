-- One food database: the Italian products of Open Food Facts are imported in
-- bulk into food_items (scripts/off-import, run weekly by GitHub Actions from
-- their nightly data export), so the app can search them as the person types
-- with a plain query against our own Postgres — no call to the Open Food Facts
-- API, whose rate limits forbid search-as-you-type.
create extension if not exists pg_trgm with schema extensions;

-- How often the product is scanned on Open Food Facts: the search ranks by it.
alter table public.food_items add column if not exists popularity integer not null default 0;

create index if not exists food_items_search_idx on public.food_items
  using gin ((lower(name || ' ' || coalesce(brand, ''))) extensions.gin_trgm_ops)
  where source <> 'fitlab';

-- Products whose name + brand contain every word of the query, most scanned
-- first. The bundled catalogue (source = 'fitlab') is searched on the device,
-- so it is left out here. Runs with the caller's rights (RLS: any signed-in
-- user can read food_items).
create or replace function public.search_foods(q text, max_results integer default 30)
returns setof public.food_items
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  pats text[];
begin
  select array_agg(p order by length(p) desc)
    into pats
    from (
      select '%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%' as p
      from unnest(regexp_split_to_array(lower(btrim(coalesce(q, ''))), '\s+')) as w
      where length(w) >= 2
      limit 6
    ) s;
  if pats is null then
    return;
  end if;
  return query
    select f.*
    from public.food_items f
    where f.source <> 'fitlab'
      -- The longest word first, alone: it is the one the trigram index can use.
      and lower(f.name || ' ' || coalesce(f.brand, '')) like pats[1]
      and lower(f.name || ' ' || coalesce(f.brand, '')) like all (pats)
    order by f.popularity desc, length(f.name), f.id
    limit least(greatest(coalesce(max_results, 30), 1), 50);
end;
$$;

revoke all on function public.search_foods(text, integer) from public, anon;
grant execute on function public.search_foods(text, integer) to authenticated, service_role;
