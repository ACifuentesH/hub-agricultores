-- Nueva fuente: servicio "grAIn" (estimaciones-export, proyecto
-- nwouogywyofnvxsgjttd) trae cosecha real por lote -- ha_cosechadas,
-- avance_ha_pct y rendimiento_kg_ha ya calculados del lado de origen, más
-- granular que lo que trae el espejo saturno.lotes. La ingesta corre en la
-- edge function grain-estimaciones-sync (lee GRAIN_ESTIMACIONES_API_KEY
-- como secreto, nunca en texto plano).
--
-- Reglas de calidad ya aplicadas en la edge function (ver su comentario):
-- toneladas 0/null -> ha_cosechadas/avance_ha_pct quedan NULL (no cero);
-- rendimiento_kg_ha > 12.000 kg/ha se guarda marcado `rendimiento_sospechoso`.

create table if not exists public.rendimiento_real (
  lote_id_raw text primary key,
  ciclo text,
  codigo_lote text,
  nombre_lote text,
  up_code text,
  unidad_produccion_id text,
  nombre_finca text,
  nombre_agricultor text,
  up_estado text,
  ha_sembradas numeric,
  numero_ha numeric,
  ha_cosechadas numeric,
  avance_ha_pct numeric,
  toneladas numeric,
  rendimiento_kg_ha numeric,
  rendimiento_sospechoso boolean not null default false,
  registros_cosecha numeric,
  humedad_promedio numeric,
  actualizado_at_origen timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.rendimiento_real enable row level security;
-- Sin políticas para anon/authenticated: se consume vía v_lote_detalle
-- (security_invoker), no directo -- mismo patrón que lote_derivado.

revoke all on table public.rendimiento_real from anon, authenticated;
grant all on table public.rendimiento_real to service_role;

create index if not exists rendimiento_real_up_code_idx on public.rendimiento_real (up_code);

-- avance_pct y el rendimiento real entran a saturno_refrescar_derivados()
-- con la prioridad más alta: es cosecha ya reconciliada por lote (aunque
-- "sin conciliar contra SAP" según el propio servicio), más fina que
-- ha_cosechadas/ha_sembradas de saturno.lotes.
alter table public.lote_derivado
  add column if not exists rendimiento_kg_ha numeric,
  add column if not exists rendimiento_sospechoso boolean;

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
    (case
      when uv.fecha_visita is not null
        and uv.fecha_visita >= coalesce(up.fecha, '0001-01-01') and uv.fecha_visita >= coalesce(acf.fecha, '0001-01-01')
        then uv.fase
      when up.fecha is not null
        and up.fecha >= coalesce(uv.fecha_visita, '0001-01-01') and up.fecha >= coalesce(acf.fecha, '0001-01-01')
        then up.fase
      when acf.fecha is not null
        then acf.fase
      else coalesce(uv.fase, up.fase)
    end),
    null::numeric, -- se recalcula abajo (incluye rendimiento_real)
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
        and uv.fecha_visita >= coalesce(up.fecha, '0001-01-01') and uv.fecha_visita >= coalesce(acf.fecha, '0001-01-01')
        then uv.fecha_visita
      when up.fecha is not null
        and up.fecha >= coalesce(uv.fecha_visita, '0001-01-01') and up.fecha >= coalesce(acf.fecha, '0001-01-01')
        then up.fecha
      when acf.fecha is not null
        then acf.fecha
      else coalesce(uv.fecha_visita, up.fecha)
    end),
    (case
      when uv.fecha_visita is not null
        and uv.fecha_visita >= coalesce(up.fecha, '0001-01-01') and uv.fecha_visita >= coalesce(acf.fecha, '0001-01-01')
        then 'seguimiento'
      when up.fecha is not null
        and up.fecha >= coalesce(uv.fecha_visita, '0001-01-01') and up.fecha >= coalesce(acf.fecha, '0001-01-01')
        then 'plantabilidad'
      when acf.fecha is not null
        then 'actividad'
      when uv.fase is not null
        then 'seguimiento'
      when up.fase is not null
        then 'plantabilidad'
      else null
    end),
    uv.fecha_visita,
    up.fecha,
    null::numeric, -- rendimiento_kg_ha, se rellena abajo desde rendimiento_real
    null::boolean,
    now()
  from saturno.lotes s
  left join ultima_visita uv on uv.lote_id = s.lote_id
  left join encaladas e on e.lote_id = s.lote_id
  left join ultima_actividad ua on ua.lote_id = s.lote_id
  left join ultima_plantabilidad up on up.lote_id = s.lote_id
  left join actividad_con_fase acf on acf.lote_id = s.lote_id
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

  -- rendimiento_kg_ha desde rendimiento_real, emparejado por lote_id crudo.
  update public.lote_derivado d
  set rendimiento_kg_ha = r.rendimiento_kg_ha,
      rendimiento_sospechoso = r.rendimiento_sospechoso
  from saturno.lotes s
  join public.rendimiento_real r on r.lote_id_raw = s.lote_id
  where s.ciclo_id = v_ciclo_id
    and d.lote_id = uuid_generate_v5(v_ns, s.lote_id);

  -- avance_pct: cosecha real de grAIn (avance_ha_pct) > cosecha real de
  -- saturno.lotes (ratio) > fase elegida > null.
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

-- v_lote_detalle expone el rendimiento real.
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
  case when d.fecha_visita >= current_date - 30 then d.estado_experto else null end as estado_lote,
  d.fase,
  d.avance_pct,
  d.fecha_visita,
  d.tecnico,
  d.observaciones,
  d.acuerdos,
  case when d.fecha_visita >= current_date - 30 then d.estado_experto else null end as estado_experto,
  d.ultima_actividad_fecha,
  d.ultima_actividad_tipo,
  d.ultima_actividad_comentario,
  d.ultima_actividad_tecnico,
  d.fase_fecha,
  d.fase_fuente,
  case when coalesce(d.rendimiento_sospechoso, false) then null else d.rendimiento_kg_ha end as rendimiento_kg_ha
from public.lotes l
left join public.lote_derivado d on d.lote_id = l.lote_id;
