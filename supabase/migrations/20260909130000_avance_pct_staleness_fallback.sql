-- Segunda mitad del fix de frescura (09-sep-2026): la migración anterior
-- (20260909120000) agregó "última actividad" como tarjeta extra, pero dejó
-- intactos avance_pct y fase_dominante — que siguen sacándose ÚNICAMENTE de
-- saturno.seguimiento. Confirmado con el usuario: el % de avance en el
-- dashboard seguía mostrando el valor de la última visita fenológica, aunque
-- esa visita fuera de mayo — para un lote sembrado en abril, eso es "V3"
-- congelado 4 meses, mientras el lote ya viene siendo trabajado para cosecha
-- según actividades_registro.
--
-- Fix: si la visita medida tiene más de 30 días, avance_pct deja de confiar
-- ciegamente en ella y cae a un estimado por calendario (días desde siembra
-- / 120, mismo DIAS_CICLO que ya usa lib/corn-stages.ts en el front). No es
-- tan preciso como una medición fresca, pero es muchísimo más preciso que
-- una medición de hace 4 meses. Mismo criterio para fase_dominante en
-- v_agricultor_resumen: el modo solo se calcula sobre fases medidas en los
-- últimos 30 días, para no anclar el "estado típico" del agricultor a una
-- foto vieja.

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
      -- Visita fresca (<= 30 días): confiar en la fase medida, como siempre.
      when uv.fecha_visita is not null and uv.fecha_visita >= current_date - v_dias_frescura
        then public.saturno_fase_avance_pct(uv.fase)
      -- Visita vieja o inexistente: estimado por calendario, acotado a [0,100].
      else
        round(
          100.0 * least(1.0, greatest(0.0,
            (current_date - public.saturno_fecha(nullif(s.fecha_inicio_siembra_real, '')))::numeric
              / v_dias_ciclo
          )),
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

-- fase_dominante: mismo criterio de frescura (30 días) para no anclar el
-- "estado típico" del agricultor a una visita vieja.
create or replace view public.v_agricultor_resumen
with (security_invoker = true) as
select
  l.agricultor_id,
  l.ciclo,
  count(*) as lotes,
  count(*) filter (where lower(coalesce(d.estado_experto, '')) in ('muy bueno', 'excelente')) as lotes_muy_buenos,
  count(*) filter (where lower(coalesce(d.estado_experto, '')) = 'bueno') as lotes_buenos,
  count(*) filter (where lower(coalesce(d.estado_experto, '')) = 'regular') as lotes_regulares,
  count(*) filter (where lower(coalesce(d.estado_experto, '')) = 'malo') as lotes_malos,
  count(*) filter (where d.estado_experto is null) as lotes_sin_evaluar,
  mode() within group (order by d.fase)
    filter (where d.fase is not null and d.fecha_visita >= current_date - 30) as fase_dominante,
  count(*) filter (where d.fase is not null and d.fecha_visita >= current_date - 30) as lotes_con_fase,
  avg(d.avance_pct) as avance_promedio
from public.lotes l
left join public.lote_derivado d on d.lote_id = l.lote_id
group by l.agricultor_id, l.ciclo;

-- Refrescar ya con la fórmula nueva.
select public.saturno_refrescar_derivados();
