-- Fix: AgricultorRainMonthlyChart solo dibuja el año en curso si
-- vista_prediccion_lluvia_lote trae algo (prediccionMensual.ts:315 —
-- `yearsSet.add(ANIO_ACTUAL)` solo si `actual.length > 0`), y esa vista
-- depende de prediccion_estacion_cache, que estaba vacía por la misma razón
-- que lluvia_diaria_estacion: refrescar_prediccion_cache() nunca se recreó.
--
-- No tenemos el algoritmo original (factor_usado, metodo_usado detallado).
-- Esta versión usa el método más simple defendible — promedio histórico del
-- mismo mes en años anteriores, por la MISMA estación (fuente_tipo
-- 'misma_estacion' siempre: la triangulación entre estaciones está
-- deshabilitada a propósito, ver AGENTS.md "Sin triangulación") — y marca
-- es_pronostico cuando el mes no acumula al menos 15 días de dato real
-- (mismo umbral que ya usa components/clima/prediccionMensual.ts).

create unique index if not exists prediccion_estacion_cache_station_anio_mes_key
  on public.prediccion_estacion_cache (station_id, anio, mes);

create or replace function public.refrescar_prediccion_cache()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anio int := extract(year from current_date)::int;
begin
  with hist_mensual as (
    select station_id, extract(month from dia)::int as mes, sum(lluvia_mm) as total
    from public.lluvia_diaria_estacion
    where extract(year from dia) < v_anio
    group by station_id, extract(month from dia)::int, extract(year from dia)::int
  ),
  historico as (
    select station_id, mes, avg(total) as historico
    from hist_mensual
    group by station_id, mes
  ),
  actual_mensual as (
    select station_id, extract(month from dia)::int as mes,
           sum(lluvia_mm) as valor_real, count(*) as dias_con_dato
    from public.lluvia_diaria_estacion
    where extract(year from dia) = v_anio
    group by station_id, extract(month from dia)::int
  ),
  estaciones_meses as (
    select e.station_id, m.mes
    from (select distinct station_id from public.lluvia_diaria_estacion) e
    cross join generate_series(1, 12) as m(mes)
  )
  insert into public.prediccion_estacion_cache (
    station_id, anio, mes, historico, valor_real, dias_con_dato, valor,
    es_pronostico, es_mes_excluido_por_calidad, metodo_usado, factor_usado,
    fuente_tipo, fuente_station_id, fuente_distancia_km, actualizado_en
  )
  select
    em.station_id,
    v_anio,
    em.mes,
    h.historico,
    am.valor_real,
    coalesce(am.dias_con_dato, 0),
    coalesce(h.historico, 0),
    coalesce(am.dias_con_dato, 0) < 15,
    coalesce(am.dias_con_dato, 0) > 0 and am.dias_con_dato < 15,
    case when h.historico is not null then 'historico_promedio' else 'sin_datos' end,
    null,
    'misma_estacion',
    em.station_id,
    0,
    now()
  from estaciones_meses em
  left join historico h on h.station_id = em.station_id and h.mes = em.mes
  left join actual_mensual am on am.station_id = em.station_id and am.mes = em.mes
  on conflict (station_id, anio, mes) do update set
    historico = excluded.historico,
    valor_real = excluded.valor_real,
    dias_con_dato = excluded.dias_con_dato,
    valor = excluded.valor,
    es_pronostico = excluded.es_pronostico,
    es_mes_excluido_por_calidad = excluded.es_mes_excluido_por_calidad,
    metodo_usado = excluded.metodo_usado,
    fuente_tipo = excluded.fuente_tipo,
    fuente_station_id = excluded.fuente_station_id,
    fuente_distancia_km = excluded.fuente_distancia_km,
    actualizado_en = now();
end;
$$;

revoke all on function public.refrescar_prediccion_cache() from public;
grant execute on function public.refrescar_prediccion_cache() to service_role;

-- Backfill inicial.
select public.refrescar_prediccion_cache();

-- Cron: encadenado con el refresco de lluvia diaria, mismo horario que
-- documentaba MIGRACION_SUPABASE_ORG.md (cada 15 min).
select cron.unschedule('refrescar-lluvia-diaria')
where exists (select 1 from cron.job where jobname = 'refrescar-lluvia-diaria');

select cron.schedule(
  'refrescar-lluvia-diaria',
  '*/15 * * * *',
  $$select public.refrescar_lluvia_diaria_estacion(3); select public.refrescar_prediccion_cache();$$
);
