-- Reportado con evidencia dura (Ezequiel Fontiveros, P17, 14-sep-2026): sus
-- 11 lotes no tienen NADA en saturno.cosecha ni saturno.lote_cosecha (0 filas
-- cada una, verificado bajando el volcado), y unidades_de_produccion.
-- rendimiento_ha_real esta vacio -- no ha cosechado un solo grano. Aun asi
-- el estimado "por calendario" (20260914120000) le mostraba avance_pct entre
-- 94-95% en TODOS sus lotes, incluso al lado de una fase medida V5 (27.8%
-- real segun saturno_fase_avance_pct). Es una cifra inventada que contradice
-- el propio dato medido del mismo lote.
--
-- Se elimina el estimado por calendario por completo. Nueva prioridad:
--   1) ha_cosechadas real (sin cambios, sigue siendo el dato mas duro)
--   2) la fase medida MAS RECIENTE, sin importar su antiguedad -- un dato
--      real viejo es preferible a un numero inventado. El front debe seguir
--      mostrando la fecha de esa medicion al lado para que quede claro que
--      puede estar desactualizada (ver cultivo/page.tsx).
--   3) si nunca hubo visita ni cosecha: avance_pct queda NULL. Mismo
--      principio que ya aplica AGENTS.md para lotes sin sembrar -- no
--      inventar un numero solo para no dejar el campo vacio.

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
    case
      -- Cosecha real: el dato mas duro que hay, manda siempre que exista.
      when nullif(s.ha_cosechadas, '')::numeric > 0 and nullif(s.ha_sembradas, '')::numeric > 0
        then round(least(100.0,
          100.0 * nullif(s.ha_cosechadas, '')::numeric / nullif(s.ha_sembradas, '')::numeric
        ), 1)
      -- Fase medida, sin importar la antiguedad: dato real, mejor que una
      -- cifra inventada por calendario. El front muestra la fecha al lado.
      when uv.fase is not null
        then public.saturno_fase_avance_pct(uv.fase)
      -- Nunca se midio nada: no inventar numero, dejar en null.
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

-- fase_dominante: se saca el filtro de 30 dias. Mostrar la fase real mas
-- reciente (aunque vieja) es preferible a esconderla -- el front debe
-- acompanarla siempre de su fecha (FaseActualCard).
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
  max(d.fecha_visita) filter (where d.fase is not null) as fase_dominante_fecha
from public.lotes l
left join public.lote_derivado d on d.lote_id = l.lote_id
group by l.agricultor_id, l.ciclo;

-- Refrescar ya con la formula nueva.
select public.saturno_refrescar_derivados();
