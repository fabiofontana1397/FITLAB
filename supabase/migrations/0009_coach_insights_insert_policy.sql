-- Bug fix: 0008 gave coach_insights a select policy and a dismissed-only
-- update grant ("writes are Edge-Function-only"), but the generate-insights
-- function writes through the same JWT-scoped user client every other
-- specialist uses (not the service-role key) — so it needs an insert
-- policy too, or RLS default-deny blocks its own inserts. This doesn't
-- weaken the original intent: a client can still only ever insert rows
-- under its own auth.uid(), and still can't rewrite an existing row's
-- headline/body (no update policy for those columns) — just create new
-- ones, same as chat_messages_insert_own already allows for chat.
create policy "coach_insights_insert_own" on public.coach_insights for insert with check (auth.uid() = user_id);
