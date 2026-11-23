-- Security advisor findings (pre App Store): SECURITY DEFINER functions reachable through the REST API.
-- handle_new_user() is only a trigger: nobody needs to call it over RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- The knowledge search is called by the AI agents with the signed-in user's JWT: never by anonymous visitors.
revoke execute on function public.match_knowledge_chunks(public.vector, text, integer) from public, anon;
grant execute on function public.match_knowledge_chunks(public.vector, text, integer) to authenticated, service_role;
