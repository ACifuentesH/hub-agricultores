-- Dos correcciones sobre el fix de frescura anterior (20260909130000),
-- reportadas por el usuario con datos concretos de Angela Rosa Guedez
-- Morales (14-sep-2026):
--
-- 1) avance_pct llegaba a 100% por calendario sin que hubiera una sola
--    hectarea cosechada registrada (ej. "Villa Marina 2": ha_cosechadas=0,
--    avance_pct=100.0). En AvanceCultivoChart el 100% literalmente dice
--    "Cosecha" -- es una afirmacion falsa sin evidencia. El estimado por
--    calendario ahora tope en 95%; el 100% real queda reservado para lotes
--    con ha_cosechadas > 0, usando el ratio real cosechado/sembrado cuando
--    existe (mas confiable que el calendario una vez que hay dato real).
--
-- 2) estado_lote/estado_experto (la valoracion "Regular"/"Malo" del tecnico)
--    nunca tuvo el mismo filtro de frescura de 30 dias que ya tiene
--    fase_dominante -- se mostraba la opinion de la ultima visita aunque
--    fuera de hace 4 meses, sin avisar que estaba vieja. v_lote_detalle
--    ahora la nula cuando la visita es vieja (el dato crudo se conserva en
--    lote_derivado, solo se filtra en la vista que consume la app), y el
--    fallback de "Actividad reciente" que ya existe en el dashboard
--    (commit 48fb480) cubre el hueco.

create or replace function public.saturno_refrescar_derivados()
returns void
language plpgsql
security definer
set search_path = public, saturno, extensions
as $$
declare
  v_ns uuid := '3f6b6e4a-7b7b-4b8a-9c8a-0f7a6c9b7b6a';
  v_ciclo_id text;
  v_dias_ciclo int := 120;
  v_dias_frescura int := 30;
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
    case
      -- Visita fresca (<= 30 dias): la fase medida manda, como siempre.
      when uv.fecha_visita is not null and uv.fecha_visita >= current_date - v_dias_frescura
        then public.saturno_fase_avance_pct(uv.fase)
      -- Hay cosecha real registrada: el ratio cosechado/sembrado es mas
      -- confiable que cualquier estimado, y SI puede llegar a 100%.
      when nullif(s.ha_cosechadas, '')::numeric > 0 and nullif(s.ha_sembradas, '')::numeric > 0
        then round(least(100.0,
          100.0 * nullif(s.ha_cosechadas, '')::numeric / nullif(s.ha_sembradas, '')::numeric
        ), 1)
      -- Ni visita fresca ni cosecha: estimado por calendario, tope en 95% a
      -- proposito -- nunca debe leerse como "cosecha completa" sin evidencia.
      else
        round(
          least(95.0, 100.0 * least(1.0, greatest(0.0,
            (current_date - public.saturno_fecha(nullif(s.fecha_inicio_siembra_real, '')))::numeric
              / v_dias_ciclo
          ))),
          1
        )
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

-- estado_lote/estado_experto: mismo criterio de 30 dias que fase_dominante.
-- El dato crudo sigue completo en lote_derivado -- solo se filtra aca.
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
  d.ultima_actividad_tecnico
from public.lotes l
left join public.lote_derivado d on d.lote_id = l.lote_id;

-- Refrescar ya con la formula nueva.
select public.saturno_refrescar_derivados();
