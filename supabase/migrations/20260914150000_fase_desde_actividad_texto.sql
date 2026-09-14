-- Hallazgo con evidencia dura (Celso Fantinel, G07, 14-sep-2026): la ultima
-- visita FORMAL en saturno.seguimiento es del 23/jul (fases V5-V8), pero el
-- tecnico Alex Gomez sigue visitando cada semana y el 24/ago hizo una ronda
-- completa por TODOS sus lotes registrada en saturno.actividades_registro,
-- con la fase mencionada en el propio comentario: "mazorcas en R2 R3",
-- "cultivo en R4", "en pleno proceso reproductivo". Esa fase mas reciente
-- nunca se usaba porque actividades_registro no tiene una columna de fase
-- estructurada -- esta en texto libre dentro de comentarios_actividad.
--
-- saturno_extraer_fase_de_texto() la rescata: busca tokens tipo V7/R3 en el
-- comentario y se queda con el de ordinal mas alto (el mas avanzado
-- mencionado). Si ninguno matchea una fase valida (V1..V12/R1..R6),
-- devuelve null -- no inventa nada nuevo, solo deja de ignorar un dato real
-- que ya estaba ahi.
--
-- La fase final del lote pasa a ser la MAS RECIENTE entre seguimiento (visita
-- formal) y esta extraccion de actividades_registro (texto libre) -- la que
-- tenga la fecha mas nueva gana, con su fuente marcada para que el front no
-- la presente como si fueran lo mismo.

create or replace function public.saturno_extraer_fase_de_texto(p text)
returns text
language sql
immutable
as $$
  select upper(m[1])
  from regexp_matches(coalesce(p, ''), '\m([VvRr][0-9]{1,2})\M', 'g') as m
  where public.saturno_fase_avance_pct(upper(m[1])) is not null
  order by public.saturno_fase_avance_pct(upper(m[1])) desc
  limit 1
$$;

alter table public.lote_derivado
  add column if not exists fase_fecha date,
  add column if not exists fase_fuente text;

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
  -- Fase mencionada en el comentario de la actividad MAS RECIENTE que
  -- mencione una (no necesariamente la ultima_actividad de arriba: esa
  -- puede ser una aplicacion de control sin mencion de fase).
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
  fase_final as (
    select
      s.lote_id,
      case
        when acf.fecha is not null and (uv.fecha_visita is null or acf.fecha > uv.fecha_visita)
          then acf.fase
        else uv.fase
      end as fase,
      case
        when acf.fecha is not null and (uv.fecha_visita is null or acf.fecha > uv.fecha_visita)
          then acf.fecha
        else uv.fecha_visita
      end as fase_fecha,
      case
        when acf.fecha is not null and (uv.fecha_visita is null or acf.fecha > uv.fecha_visita)
          then 'actividad'
        else 'seguimiento'
      end as fase_fuente
    from saturno.lotes s
    left join ultima_visita uv on uv.lote_id = s.lote_id
    left join actividad_con_fase acf on acf.lote_id = s.lote_id
    where s.ciclo_id = v_ciclo_id
  )
  insert into public.lote_derivado (
    lote_id, fase, avance_pct, fecha_visita, tecnico, observaciones, acuerdos,
    estado_experto, ha_encaladas,
    ultima_actividad_fecha, ultima_actividad_tipo, ultima_actividad_comentario,
    ultima_actividad_tecnico, fase_fecha, fase_fuente, updated_at
  )
  select
    uuid_generate_v5(v_ns, s.lote_id),
    ff.fase,
    case
      when nullif(s.ha_cosechadas, '')::numeric > 0 and nullif(s.ha_sembradas, '')::numeric > 0
        then round(least(100.0,
          100.0 * nullif(s.ha_cosechadas, '')::numeric / nullif(s.ha_sembradas, '')::numeric
        ), 1)
      when ff.fase is not null
        then public.saturno_fase_avance_pct(ff.fase)
      else null
    end,
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
    ff.fase_fecha,
    ff.fase_fuente,
    now()
  from saturno.lotes s
  left join ultima_visita uv on uv.lote_id = s.lote_id
  left join encaladas e on e.lote_id = s.lote_id
  left join ultima_actividad ua on ua.lote_id = s.lote_id
  left join fase_final ff on ff.lote_id = s.lote_id
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
    fase_fecha = excluded.fase_fecha,
    fase_fuente = excluded.fase_fuente,
    updated_at = now();
end;
$$;

revoke all on function public.saturno_refrescar_derivados() from public;
grant execute on function public.saturno_refrescar_derivados() to service_role;

-- v_lote_detalle expone la fecha/fuente de la fase, y estado_lote/estado_experto
-- mantienen su propio criterio de 30 dias (siguen viniendo solo de la visita
-- formal -- no hay una "valoracion Excelente/Regular" confiable en texto libre).
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
  d.fase_fuente
from public.lotes l
left join public.lote_derivado d on d.lote_id = l.lote_id;

-- fase_dominante usa el mismo fase_fecha (la mas reciente entre las dos
-- fuentes), sin filtro de 30 dias -- mostrar la real, con su fecha.
create or replace view public.v_agricultor_resumen
with (security_invoker = true) as
select
  l.agricultor_id,
  l.ciclo,
  count(*) as lotes,
  count(*) filter (
    where d.fecha_visita >= current_date - 30
      and lower(coalesce(d.estado_experto, '')) in ('muy bueno', 'excelente')
  ) as lotes_muy_buenos,
  count(*) filter (
    where d.fecha_visita >= current_date - 30
      and lower(coalesce(d.estado_experto, '')) = 'bueno'
  ) as lotes_buenos,
  count(*) filter (
    where d.fecha_visita >= current_date - 30
      and lower(coalesce(d.estado_experto, '')) = 'regular'
  ) as lotes_regulares,
  count(*) filter (
    where d.fecha_visita >= current_date - 30
      and lower(coalesce(d.estado_experto, '')) = 'malo'
  ) as lotes_malos,
  count(*) filter (
    where d.estado_experto is null
      or d.fecha_visita is null
      or d.fecha_visita < current_date - 30
  ) as lotes_sin_evaluar,
  mode() within group (order by d.fase) filter (where d.fase is not null) as fase_dominante,
  count(*) filter (where d.fase is not null) as lotes_con_fase,
  avg(d.avance_pct) as avance_promedio,
  max(d.fase_fecha) filter (where d.fase is not null) as fase_dominante_fecha
from public.lotes l
left join public.lote_derivado d on d.lote_id = l.lote_id
group by l.agricultor_id, l.ciclo;

-- Refrescar ya con la formula nueva.
select public.saturno_refrescar_derivados();
