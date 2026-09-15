-- Cuarta fuente de fase: recurso "resumen" del servicio grAIn trae
-- estado_fenologico_texto (ej. "R4") estructurado por lote, con fecha de
-- evaluacion y tecnico -- viene de las planillas Excel de estimacion de
-- rendimiento que los tecnicos suben a grAIn. A diferencia de
-- actividades_registro (texto libre, había que extraer con regex), este es
-- un campo ya resuelto, sin ambigüedad.
--
-- OJO: resumen/muestras traen su propio rendimiento_kg_ha, pero es un
-- ESTIMADO (metodo PMG, recalculado por grAIn) -- se guarda en
-- fase_estimacion_grain.rendimiento_estimado_kg_ha, NUNCA se mezcla con
-- rendimiento_real ni se expone como si fuera cosecha real. Ver
-- recurso=info: "ESTIMADO -- rendimiento_kg_ha es el valor recalculado por
-- grAIn" (resumen) vs "REAL -- cosecha_lote".

create table if not exists public.fase_estimacion_grain (
  lote_id_raw text primary key,
  ciclo text,
  estimacion_id text,
  lote_texto text,
  hibrido_texto text,
  estado_fenologico_texto text,
  fecha_evaluacion date,
  tecnico_correo text,
  codigo_up text,
  nombre_agricultor text,
  superficie_ha numeric,
  muestras_validas numeric,
  mazorcas_promedio numeric,
  granos_promedio numeric,
  pmg_promedio numeric,
  rendimiento_estimado_kg_ha numeric, -- ESTIMADO, no usar como rendimiento real
  produccion_estimada_t numeric,
  cargado_at_origen timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.fase_estimacion_grain enable row level security;
revoke all on table public.fase_estimacion_grain from anon, authenticated;
grant all on table public.fase_estimacion_grain to service_role;

create index if not exists fase_estimacion_grain_codigo_up_idx on public.fase_estimacion_grain (codigo_up);

-- saturno_refrescar_derivados() ahora compara CUATRO fuentes de fase por
-- fecha (seguimiento, plantabilidad, actividad-texto, grAIn-resumen) y usa
-- la mas reciente. Empate: seguimiento > plantabilidad > grAIn > actividad
-- (de mas a menos estructurada).
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
  ),
  actividad_con_fase as (
    select distinct on (a.lote_id)
      a.lote_id,
      public.saturno_fecha(nullif(a.fecha_inicio, '')) as fecha,
      public.saturno_extraer_fase_de_texto(a.comentarios_actividad) as fase
    from saturno.actividades_registro a
    where a.ciclo_id = v_ciclo_id
      and public.saturno_extraer_fase_de_texto(a.comentarios_actividad) is not null
    order by
      a.lote_id,
      public.saturno_fecha(nullif(a.fecha_inicio, '')) desc nulls last,
      nullif(a.rownumber, '')::int desc nulls last
  ),
  ultima_plantabilidad as (
    select distinct on (p.lote_id)
      p.lote_id,
      public.saturno_fecha(nullif(p.fecha_seguimiento, '')) as fecha,
      nullif(ef.nombre, '') as fase
    from saturno.plantabilidad p
    left join saturno.estado_fenologico ef on ef.estado_fenologico_id = p.estado_fenologico
    where p.ciclo_cosecha_id = v_ciclo_id
    order by
      p.lote_id,
      public.saturno_fecha(nullif(p.fecha_seguimiento, '')) desc nulls last,
      nullif(p.rownumber, '')::int desc nulls last
  ),
  grain_fase as (
    select
      g.lote_id_raw as lote_id,
      g.fecha_evaluacion as fecha,
      nullif(g.estado_fenologico_texto, '') as fase
    from public.fase_estimacion_grain g
    where g.ciclo = v_ciclo_id
      and g.estado_fenologico_texto is not null
  )
  insert into public.lote_derivado (
    lote_id, fase, avance_pct, fecha_visita, tecnico, observaciones, acuerdos,
    estado_experto, ha_encaladas,
    ultima_actividad_fecha, ultima_actividad_tipo, ultima_actividad_comentario,
    ultima_actividad_tecnico, fase_fecha, fase_fuente,
    fase_fecha_seguimiento, fase_fecha_plantabilidad,
    rendimiento_kg_ha, rendimiento_sospechoso, updated_at
  )
  select
    uuid_generate_v5(v_ns, s.lote_id),
    -- La fase de la fuente con fecha mas reciente entre las 4. Empate:
    -- seguimiento > plantabilidad > grAIn > actividad.
    (case
      when uv.fecha_visita is not null
        and uv.fecha_visita >= coalesce(up.fecha, '0001-01-01')
        and uv.fecha_visita >= coalesce(gf.fecha, '0001-01-01')
        and uv.fecha_visita >= coalesce(acf.fecha, '0001-01-01')
        then uv.fase
      when up.fecha is not null
        and up.fecha >= coalesce(uv.fecha_visita, '0001-01-01')
        and up.fecha >= coalesce(gf.fecha, '0001-01-01')
        and up.fecha >= coalesce(acf.fecha, '0001-01-01')
        then up.fase
      when gf.fecha is not null
        and gf.fecha >= coalesce(uv.fecha_visita, '0001-01-01')
        and gf.fecha >= coalesce(up.fecha, '0001-01-01')
        and gf.fecha >= coalesce(acf.fecha, '0001-01-01')
        then gf.fase
      when acf.fecha is not null
        then acf.fase
      else coalesce(uv.fase, up.fase, gf.fase)
    end) as fase_elegida,
    null::numeric,
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
    (case
      when uv.fecha_visita is not null
        and uv.fecha_visita >= coalesce(up.fecha, '0001-01-01')
        and uv.fecha_visita >= coalesce(gf.fecha, '0001-01-01')
        and uv.fecha_visita >= coalesce(acf.fecha, '0001-01-01')
        then uv.fecha_visita
      when up.fecha is not null
        and up.fecha >= coalesce(uv.fecha_visita, '0001-01-01')
        and up.fecha >= coalesce(gf.fecha, '0001-01-01')
        and up.fecha >= coalesce(acf.fecha, '0001-01-01')
        then up.fecha
      when gf.fecha is not null
        and gf.fecha >= coalesce(uv.fecha_visita, '0001-01-01')
        and gf.fecha >= coalesce(up.fecha, '0001-01-01')
        and gf.fecha >= coalesce(acf.fecha, '0001-01-01')
        then gf.fecha
      when acf.fecha is not null
        then acf.fecha
      else coalesce(uv.fecha_visita, up.fecha, gf.fecha)
    end) as fase_fecha_elegida,
    (case
      when uv.fecha_visita is not null
        and uv.fecha_visita >= coalesce(up.fecha, '0001-01-01')
        and uv.fecha_visita >= coalesce(gf.fecha, '0001-01-01')
        and uv.fecha_visita >= coalesce(acf.fecha, '0001-01-01')
        then 'seguimiento'
      when up.fecha is not null
        and up.fecha >= coalesce(uv.fecha_visita, '0001-01-01')
        and up.fecha >= coalesce(gf.fecha, '0001-01-01')
        and up.fecha >= coalesce(acf.fecha, '0001-01-01')
        then 'plantabilidad'
      when gf.fecha is not null
        and gf.fecha >= coalesce(uv.fecha_visita, '0001-01-01')
        and gf.fecha >= coalesce(up.fecha, '0001-01-01')
        and gf.fecha >= coalesce(acf.fecha, '0001-01-01')
        then 'grain'
      when acf.fecha is not null
        then 'actividad'
      when uv.fase is not null
        then 'seguimiento'
      when up.fase is not null
        then 'plantabilidad'
      when gf.fase is not null
        then 'grain'
      else null
    end) as fase_fuente_elegida,
    uv.fecha_visita,
    up.fecha,
    null::numeric,
    null::boolean,
    now()
  from saturno.lotes s
  left join ultima_visita uv on uv.lote_id = s.lote_id
  left join encaladas e on e.lote_id = s.lote_id
  left join ultima_actividad ua on ua.lote_id = s.lote_id
  left join ultima_plantabilidad up on up.lote_id = s.lote_id
  left join actividad_con_fase acf on acf.lote_id = s.lote_id
  left join grain_fase gf on gf.lote_id = s.lote_id
  where s.ciclo_id = v_ciclo_id
  on conflict (lote_id) do update set
    fase = excluded.fase,
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
    fase_fecha = excluded.fase_fecha,
    fase_fuente = excluded.fase_fuente,
    fase_fecha_seguimiento = excluded.fase_fecha_seguimiento,
    fase_fecha_plantabilidad = excluded.fase_fecha_plantabilidad,
    updated_at = now();

  update public.lote_derivado d
  set rendimiento_kg_ha = r.rendimiento_kg_ha,
      rendimiento_sospechoso = r.rendimiento_sospechoso
  from saturno.lotes s
  join public.rendimiento_real r on r.lote_id_raw = s.lote_id
  where s.ciclo_id = v_ciclo_id
    and d.lote_id = uuid_generate_v5(v_ns, s.lote_id);

  update public.lote_derivado d
  set avance_pct = case
    when r.avance_ha_pct is not null
      then round(least(100.0, greatest(0.0, r.avance_ha_pct::numeric)), 1)
    when nullif(s.ha_cosechadas, '')::numeric > 0 and nullif(s.ha_sembradas, '')::numeric > 0
      then round(least(100.0, 100.0 * nullif(s.ha_cosechadas, '')::numeric / nullif(s.ha_sembradas, '')::numeric), 1)
    when d.fase is not null
      then public.saturno_fase_avance_pct(d.fase)
    else null
  end
  from saturno.lotes s
  left join public.rendimiento_real r on r.lote_id_raw = s.lote_id
  where s.ciclo_id = v_ciclo_id
    and d.lote_id = uuid_generate_v5(v_ns, s.lote_id);
end;
$$;

revoke all on function public.saturno_refrescar_derivados() from public;
grant execute on function public.saturno_refrescar_derivados() to service_role;

select public.saturno_refrescar_derivados();
