-- Utilidad temporal: devuelve el DDL de una vista de public para diagnóstico.
create or replace function public.debug_viewdef(p_view text)
returns text
language sql
security definer
set search_path = public
as $$
  select pg_get_viewdef(format('public.%I', p_view)::regclass, true)
$$;

revoke all on function public.debug_viewdef(text) from public;
grant execute on function public.debug_viewdef(text) to service_role;
