-- lote_derivado + v_lote_detalle + v_agricultor_resumen — el material que
-- AGENTS.md ya anticipaba ("Regla: los datos derivados del espejo se
-- materializan en tablas de public con RLS propia (ver lote_derivado),
-- rellenadas por saturno_refrescar_derivados() dentro de la promoción").
--
-- Por qué no una vista directa sobre saturno.*: esquema saturno tiene RLS sin
-- políticas (cerrado a anon/authenticated) — una vista security_invoker que
-- lo consultara devolvería 0 filas a cualquier agricultor real, el mismo
-- incidente que ya documenta AGENTS.md para v_lote_detalle contra
-- saturno.seguimiento/mecanizacion_registro. Por eso se materializa primero
-- en una tabla public con su propia RLS.

-- 1) Tabla derivada -----------------------------------------------------------

create table if not exists public.lote_derivado (
  lote_id uuid primary key references public.lotes (lote_id) on delete cascade,
  fase text,
  avance_pct numeric,
  fecha_visita date,
  tecnico text,
  observaciones text,
  acuerdos text,
  estado_experto text,
  ha_encaladas numeric,
  updated_at timestamptz not null default now()
);

alter table public.lote_derivado enable row level security;

drop policy if exists lote_derivado_select on public.lote_derivado;
create policy lote_derivado_select on public.lote_derivado
  for select to authenticated
  using (
    exists (
      select 1 from public.lotes l
      join public.user_profiles up on up.user_id = auth.uid()
      where l.lote_id = lote_derivado.lote_id
        and (up.role = 'master' or up.agricultor_id = l.agricultor_id)
    )
  );

-- 2) Fase (V1..V12, R1..R6, medida en campo per AGENTS.md) -> % de avance ----

create or replace function public.saturno_fase_avance_pct(p_fase text)
returns numeric
language sql
immutable
as $$
  select round(100.0 * t.ord / 18, 1)
  from (values
    ('V1', 1), ('V2', 2), ('V3', 3), ('V4', 4), ('V5', 5), ('V6', 6),
    ('V7', 7), ('V8', 8), ('V9', 9), ('V10', 10), ('V11', 11), ('V12', 12),
    ('R1', 13), ('R2', 14), ('R3', 15), ('R4', 16), ('R5', 17), ('R6', 18)
  ) as t(fase, ord)
  where t.fase = upper(btrim(coalesce(p_fase, '')))
$$;

-- 3) Refresco de derivados (última visita por lote + ha_encaladas) ------------

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
  )
  insert into public.lote_derivado (
    lote_id, fase, avance_pct, fecha_visita, tecnico, observaciones, acuerdos,
    estado_experto, ha_encaladas, updated_at
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
    now()
  from saturno.lotes s
  left join ultima_visita uv on uv.lote_id = s.lote_id
  left join encaladas e on e.lote_id = s.lote_id
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
    updated_at = now();
end;
$$;

revoke all on function public.saturno_refrescar_derivados() from public;
grant execute on function public.saturno_refrescar_derivados() to service_role;

-- 4) saturno_promover_lotes() ahora refresca los derivados al final -----------

create or replace function public.saturno_promover_lotes()
returns void
language plpgsql
security definer
set search_path = public, saturno, extensions
as $$
declare
  v_ns uuid := '3f6b6e4a-7b7b-4b8a-9c8a-0f7a6c9b7b6a';
  v_ciclo_id text;
  v_ciclo_anio text;
begin
  select ciclo_cosecha_id, ciclo_cosecha
    into v_ciclo_id, v_ciclo_anio
  from saturno.ciclo_de_cosecha
  where activo = 'SI'
  limit 1;

  if v_ciclo_id is null then
    raise notice 'saturno_promover_lotes: no hay ciclo activo en saturno.ciclo_de_cosecha';
    return;
  end if;

  insert into public.lotes (
    lote_id, agricultor_id, nombre_lote, ciclo, hectareas,
    fecha_siembra, ha_sembradas, ha_perdidas, ha_cosechadas
  )
  select
    uuid_generate_v5(v_ns, s.lote_id),
    ag.agricultor_id,
    coalesce(nullif(s.nombre_lote, ''), nullif(s.codigo_lote, ''), s.lote_id),
    v_ciclo_anio,
    nullif(s.numero_ha, '')::numeric,
    public.saturno_fecha(nullif(s.fecha_inicio_siembra_real, '')),
    nullif(s.ha_sembradas, '')::numeric,
    nullif(s.ha_perdidas, '')::numeric,
    nullif(s.ha_cosechadas, '')::numeric
  from saturno.lotes s
  join saturno.unidades_de_produccion u on u.unidad_produccion_id = s.unidad_produccion_id
  join public.agricultores ag on ag.id_saturno = u.codigo_up || '-' || v_ciclo_id
  where s.ciclo_id = v_ciclo_id
  on conflict (lote_id) do update set
    agricultor_id = excluded.agricultor_id,
    nombre_lote = excluded.nombre_lote,
    ciclo = excluded.ciclo,
    hectareas = excluded.hectareas,
    fecha_siembra = coalesce(public.lotes.fecha_siembra, excluded.fecha_siembra),
    ha_sembradas = excluded.ha_sembradas,
    ha_perdidas = excluded.ha_perdidas,
    ha_cosechadas = excluded.ha_cosechadas;

  perform public.saturno_refrescar_derivados();
end;
$$;

revoke all on function public.saturno_promover_lotes() from public;
grant execute on function public.saturno_promover_lotes() to service_role;

-- 5) Vistas que consume la app --------------------------------------------------

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
  d.estado_experto
from public.lotes l
left join public.lote_derivado d on d.lote_id = l.lote_id;

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
  mode() within group (order by d.fase) filter (where d.fase is not null) as fase_dominante,
  count(*) filter (where d.fase is not null) as lotes_con_fase,
  avg(d.avance_pct) as avance_promedio
from public.lotes l
left join public.lote_derivado d on d.lote_id = l.lote_id
group by l.agricultor_id, l.ciclo;
