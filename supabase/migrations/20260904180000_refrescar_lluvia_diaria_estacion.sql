-- Fix: vista_lluvia_mensual_lote y vista_lluvia_diaria_lote (gráfico mensual
-- de lluvia y grilla por lote en /clima) dependen de public.lluvia_diaria_estacion
-- (keyed por station_id, el id de hardware WeatherLink) — tabla que existía
-- pero estaba completamente vacía: la función refrescar_lluvia_diaria_estacion()
-- que la alimenta (docs/MIGRACION_SUPABASE_ORG.md §4/§5) nunca se recreó tras
-- el borrado del proyecto, así que el cron de 15 min no tenía qué ejecutar.
--
-- La fuente real ya existe y sí tiene datos: lecturas_diarias (15.151 filas,
-- 2024-05-01..2026-09-03), keyed por codigo_estacion — se agrega vía
-- estaciones.codigo_estacion -> estaciones.station_id.

create unique index if not exists lluvia_diaria_estacion_station_dia_key
  on public.lluvia_diaria_estacion (station_id, dia);

create or replace function public.refrescar_lluvia_diaria_estacion(p_dias_atras int default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lluvia_diaria_estacion (station_id, dia, lluvia_mm, lecturas, updated_at)
  select
    e.station_id,
    ld.dia,
    coalesce(ld.lluvia_mm, 0),
    ld.lecturas,
    now()
  from public.lecturas_diarias ld
  join public.estaciones e on e.codigo_estacion = ld.codigo_estacion
  where p_dias_atras is null or ld.dia >= current_date - (p_dias_atras || ' days')::interval
  on conflict (station_id, dia) do update set
    lluvia_mm = excluded.lluvia_mm,
    lecturas = excluded.lecturas,
    updated_at = now();
end;
$$;

revoke all on function public.refrescar_lluvia_diaria_estacion(int) from public;
grant execute on function public.refrescar_lluvia_diaria_estacion(int) to service_role;

-- Backfill inicial completo (una sola vez) — de acá en más el cron de 15 min
-- lo mantiene al día con refrescar_lluvia_diaria_estacion(3).
select public.refrescar_lluvia_diaria_estacion(null);
