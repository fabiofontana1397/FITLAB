-- Admin panel (read-only, phase 1): lets a few designated accounts browse every user and their plans.
--
-- No RLS policy is loosened. The panel reads through two SECURITY DEFINER functions that check
-- is_admin() first, so a normal account calling them gets an error and nothing else changes.
-- The service-role key is never involved.
--
-- Make an account an admin (SQL editor, once):
--   insert into public.app_admins (user_id) select id from auth.users where email = 'you@example.com';

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS on and no policies: clients cannot read or write the list; only the functions below (owner rights) do.
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

-- One row per user, with just enough to scan the list.
create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  goal text,
  questionnaire_version int,
  has_answers boolean,
  diet_months int,
  diet_generated_at timestamptz,
  training_months int,
  training_generated_at timestamptz,
  latest_weight_kg numeric,
  weigh_ins bigint,
  checkins bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.name,
    u.created_at,
    u.last_sign_in_at,
    p.goal,
    oa.questionnaire_version,
    oa.user_id is not null,
    dp.months,
    dp.generated_at,
    tp.months,
    tp.generated_at,
    (select bm.weight_kg from public.body_metrics bm where bm.user_id = u.id and bm.weight_kg is not null order by bm.date desc limit 1),
    (select count(*) from public.body_metrics bm where bm.user_id = u.id and bm.weight_kg is not null),
    (select count(*) from public.monthly_checkins mc where mc.user_id = u.id)
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  left join public.onboarding_answers oa on oa.user_id = u.id
  left join lateral (select d.generated_at, jsonb_array_length(d.plan) as months from public.diet_plans d where d.user_id = u.id) dp on true
  left join lateral (select t.generated_at, jsonb_array_length(t.plan) as months from public.training_plans t where t.user_id = u.id) tp on true
  order by u.created_at desc;
end;
$$;

-- Everything the app knows about one user, as one JSON document.
create or replace function public.admin_user_detail(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'user', (select to_jsonb(x) from (
      select u.id, u.email, u.created_at, u.last_sign_in_at from auth.users u where u.id = p_user
    ) x),
    'profile', (select to_jsonb(p) from public.profiles p where p.user_id = p_user),
    'answers', (select to_jsonb(oa) from public.onboarding_answers oa where oa.user_id = p_user),
    'diet_plan', (select to_jsonb(d) from public.diet_plans d where d.user_id = p_user),
    'training_plan', (select to_jsonb(t) from public.training_plans t where t.user_id = p_user),
    'plan_versions', coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from public.plan_versions v where v.user_id = p_user), '[]'::jsonb),
    'target_history', coalesce((select jsonb_agg(to_jsonb(h) order by h.effective_date desc) from public.nutrition_target_history h where h.user_id = p_user), '[]'::jsonb),
    'checkins', coalesce((select jsonb_agg(to_jsonb(c) order by c.month_index) from public.monthly_checkins c where c.user_id = p_user), '[]'::jsonb),
    'body_metrics', coalesce((select jsonb_agg(to_jsonb(b) order by b.date) from public.body_metrics b where b.user_id = p_user), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(to_jsonb(a) order by a.date desc) from (select * from public.activity_log where user_id = p_user order by date desc limit 60) a), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
