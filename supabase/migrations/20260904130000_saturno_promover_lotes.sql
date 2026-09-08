-- saturno_promover_lotes(): reconstruye public.lotes del ciclo activo desde el
-- espejo saturno.*.
--
-- Difiere del diseño original documentado en docs/SINCRONIZACION_SATURNO.md en
-- dos puntos, verificados contra datos reales del volcado 2026-09-04:
--
-- 1) Vínculo lote -> agricultor: en vez de matchear por nombre de productor
--    (saturno.lotes.nombreproductorv vs saturno.agropecuaria.nombre, que
--    trae comas y orden raro), se usa saturno.lotes.unidad_produccion_id ->
--    saturno.unidades_de_produccion.codigo_up, comparado contra
--    agricultores.id_saturno (formato "{codigo_up}-{ciclo_id}", confirmado
--    con casos reales: "S01-742cb71b" = Juan Hernández Díaz). Es la misma
--    clave que ya se usó para sembrar los 35 agricultores existentes, y evita
--    la cadena por agropecuaria_id que AGENTS.md/docs ya marcaban como poco
--    confiable (solo 24/57 llena).
--
-- 2) Reconstrucción vs upsert: el lote_id de Saturno es texto inestable entre
--    ciclos, pero acá se deriva un uuid DETERMINÍSTICO (uuid_generate_v5) a
--    partir de ese texto, así que el mismo lote de Saturno siempre cae en la
--    misma fila de public.lotes entre corridas — permite upsert real en vez
--    de borrar-y-recrear, y de paso no pisa `fecha_siembra` cuando ya fue
--    cargada a mano (app/api/lote/siembra/route.ts): Saturno rara vez trae la
--    fecha real todavía.

create extension if not exists "uuid-ossp";

drop function if exists public.saturno_promover_lotes();

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
end;
$$;

revoke all on function public.saturno_promover_lotes() from public;
grant execute on function public.saturno_promover_lotes() to service_role;
