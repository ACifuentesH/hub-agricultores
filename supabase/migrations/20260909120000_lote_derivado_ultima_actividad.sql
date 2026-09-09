-- Frescura real del lote via saturno.actividades_registro -----------------------
--
-- Hallazgo (09-sep-2026): saturno_refrescar_derivados() solo miraba
-- saturno.seguimiento (visita fenológica formal V1..V12/R1..R6) para "fase" y
-- "estado_lote". Esa tabla se queda atrás de la operación real: 154 de 264
-- lotes del ciclo activo no tienen ninguna visita de seguimiento, y de los que
-- sí, la mitad no se actualiza desde mayo — aunque el técnico sigue trabajando
-- el lote. Verificado bajando el volcado del bucket directo: el lote
-- L06-P02-742cb71b se veía "abandonado desde el 14/05" en seguimiento, pero
-- actividades_registro tiene su historial completo hasta el 31/08 (control de
-- plagas, fertilización, y ya en agosto: estimación de rendimiento y pruebas
-- de humedad de grano — monitoreo de inicio de cosecha).
--
-- saturno.actividades_registro ya llega por la ingesta genérica (no hace falta
-- tocar la edge function ni el mapa de columnas: saturno_ingerir crea la tabla
-- espejo sola). Esta migración solo agrega "última actividad" como señal de
-- frescura adicional a fase/estado, sin reemplazarlos — cuando sí hay visita
-- de seguimiento reciente, ambas deberían coincidir; cuando no, la actividad
-- de campo es lo único que prueba que el lote sigue vivo.

alter table public.lote_derivado
  add column if not exists ultima_actividad_fecha date,
  add column if not exists ultima_actividad_tipo text,
  add column if not exists ultima_actividad_comentario text,
  add column if not exists ultima_actividad_tecnico text;

create or replace function public.saturno_refrescar_derivados()
returns void
language plpgsql
security definer
set search_path = public, saturno, extensions
as $$
declare
  v_ns uuid := '3f6b6e4a-7b7b-4b8a-9c8a-0f7a6c9b7b6a';
  v_ciclo_id text;
begin
  select ciclo_cosecha_id into v_ciclo_id
  from saturno.ciclo_de_cosecha
  where activo = 'SI'
  limit 1;

  if v_ciclo_id is null then
    return;
  end if;

  with ultima_visita as (
    select distinct on (s.lote_id)
      s.lote_id,
      public.saturno_fecha(nullif(s.fecha_seguimiento, '')) as fecha_visita,
      nullif(s.nombretecnicov, '') as tecnico,
      nullif(s.expestadofenologico, '') as fase,
      nullif(s.observaciones, '') as observaciones,
      nullif(s.acuerdos, '') as acuerdos,
      nullif(s.estado_general_experto, '') as estado_experto
    from saturno.seguimiento s
    where s.ciclo_cosecha_id = v_ciclo_id
    order by
      s.lote_id,
      public.saturno_fecha(nullif(s.fecha_seguimiento, '')) desc nulls last,
      nullif(s.rownumber, '')::int desc nulls last
  ),
  encaladas as (
    select m.lote_id, sum(nullif(m.ha_aplicada, '')::numeric) as ha_encaladas
    from saturno.mecanizacion_registro m
    where m.ciclo_cosecha = v_ciclo_id
      and m.mecanizacion = 'Pase de encaladora'
    group by m.lote_id
  ),
  ultima_actividad as (
    select distinct on (a.lote_id)
      a.lote_id,
      public.saturno_fecha(nullif(a.fecha_inicio, '')) as fecha,
      nullif(a.categoriaactividadv, '') as tipo,
      nullif(a.comentarios_actividad, '') as comentario,
      nullif(a.tecnico, '') as tecnico
    from saturno.actividades_registro a
    where a.ciclo_id = v_ciclo_id
    order by
      a.lote_id,
      public.saturno_fecha(nullif(a.fecha_inicio, '')) desc nulls last,
      nullif(a.rownumber, '')::int desc nulls last
  )
  insert into public.lote_derivado (
    lote_id, fase, avance_pct, fecha_visita, tecnico, observaciones, acuerdos,
    estado_experto, ha_encaladas,
    ultima_actividad_fecha, ultima_actividad_tipo, ultima_actividad_comentario,
    ultima_actividad_tecnico, updated_at
  )
  select
    uuid_generate_v5(v_ns, s.lote_id),
    uv.fase,
    public.saturno_fase_avance_pct(uv.fase),
    uv.fecha_visita,
    uv.tecnico,
    uv.observaciones,
    uv.acuerdos,
    uv.estado_experto,
    coalesce(e.ha_encaladas, 0),
    ua.fecha,
    ua.tipo,
    ua.comentario,
    ua.tecnico,
    now()
  from saturno.lotes s
  left join ultima_visita uv on uv.lote_id = s.lote_id
  left join encaladas e on e.lote_id = s.lote_id
  left join ultima_actividad ua on ua.lote_id = s.lote_id
  where s.ciclo_id = v_ciclo_id
  on conflict (lote_id) do update set
    fase = excluded.fase,
    avance_pct = excluded.avance_pct,
    fecha_visita = excluded.fecha_visita,
    tecnico = excluded.tecnico,
    observaciones = excluded.observaciones,
    acuerdos = excluded.acuerdos,
    estado_experto = excluded.estado_experto,
    ha_encaladas = excluded.ha_encaladas,
    ultima_actividad_fecha = excluded.ultima_actividad_fecha,
    ultima_actividad_tipo = excluded.ultima_actividad_tipo,
    ultima_actividad_comentario = excluded.ultima_actividad_comentario,
    ultima_actividad_tecnico = excluded.ultima_actividad_tecnico,
    updated_at = now();
end;
$$;

revoke all on function public.saturno_refrescar_derivados() from public;
grant execute on function public.saturno_refrescar_derivados() to service_role;

-- v_lote_detalle expone la nueva señal de frescura ------------------------------

create or replace view public.v_lote_detalle
with (security_invoker = true) as
select
  l.lote_id,
  l.agricultor_id,
  l.ciclo,
  l.nombre_lote as nombre,
  l.hectareas as ha_plan,
  coalesce(d.ha_encaladas, 0) as ha_encaladas,
  l.fecha_siembra as inicio_siembra,
  l.ha_sembradas,
  l.ha_perdidas,
  l.ha_cosechadas,
  d.estado_experto as estado_lote,
  d.fase,
  d.avance_pct,
  d.fecha_visita,
  d.tecnico,
  d.observaciones,
  d.acuerdos,
  d.estado_experto,
  d.ultima_actividad_fecha,
  d.ultima_actividad_tipo,
  d.ultima_actividad_comentario,
  d.ultima_actividad_tecnico
from public.lotes l
left join public.lote_derivado d on d.lote_id = l.lote_id;

-- Refrescar ya mismo con los datos que ya están sincronizados (no hace falta
-- esperar la próxima corrida del cron de las 6h para ver el efecto).
select public.saturno_refrescar_derivados();
