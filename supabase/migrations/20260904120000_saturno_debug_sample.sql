-- Utilidad temporal de diagnóstico: muestra filas crudas de una tabla del
-- espejo saturno.* (solo service_role). Se usa para diseñar
-- saturno_promover_lotes() contra la estructura real, no contra suposiciones.

create or replace function public.saturno_debug_sample(p_tabla text, p_limit int default 3)
returns jsonb
language plpgsql
security definer
set search_path = public, saturno
as $$
declare
  v_result jsonb;
begin
  if p_tabla !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'Nombre de tabla invalido: %', p_tabla;
  end if;
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from saturno.%I limit %s) t', p_tabla, p_limit)
    into v_result;
  return v_result;
end;
$$;

revoke all on function public.saturno_debug_sample(text, int) from public;
grant execute on function public.saturno_debug_sample(text, int) to service_role;
