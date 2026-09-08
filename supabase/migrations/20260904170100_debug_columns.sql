create or replace function public.debug_columns(p_tabla text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('column', column_name, 'type', data_type) order by ordinal_position), '[]'::jsonb)
  from information_schema.columns
  where table_schema = 'public' and table_name = p_tabla
$$;

revoke all on function public.debug_columns(text) from public;
grant execute on function public.debug_columns(text) to service_role;
