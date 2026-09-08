-- Fix: saturno_promover_lotes() nunca asignaba lotes.codigo_estacion, así
-- que lib/clima.ts (resolveEstacionAgricultor) no encontraba estación para
-- nadie y el dashboard mostraba el clima vacío pese a que las lecturas sí
-- existen en estaciones/lecturas_live.
--
-- El proyecto ya tenía 4 tablas de mapeo (public, no saturno.*) de una pasada
-- de aprovisionamiento anterior — nunca se conectaron a la promoción:
--   1) saturno_finca_estacion_map (codigo_up -> codigo_estacion, 29 filas,
--      generada en bloque) — fuente primaria, misma clave que ya usamos para
--      resolver el agricultor.
--   2) excel_estaciones_faltantes_map (agricultor -> codigo_estacion, 18
--      filas) — parche para los que la asignación sistemática no cubrió
--      ("faltantes").
--   3) excel_up_estacion_map (nombre de UP -> codigo_estacion, 11 filas).
--   4) excel_productor_estacion_map (nombre de agricultor -> codigo_estacion,
--      11 filas) — último recurso.

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
    fecha_siembra, ha_sembradas, ha_perdidas, ha_cosechadas, codigo_estacion
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
    nullif(s.ha_cosechadas, '')::numeric,
    coalesce(sfe.codigo_estacion, eef.codigo_estacion, eup.codigo_estacion, epe.codigo_estacion)
  from saturno.lotes s
  join saturno.unidades_de_produccion u on u.unidad_produccion_id = s.unidad_produccion_id
  join public.agricultores ag on ag.id_saturno = u.codigo_up || '-' || v_ciclo_id
  left join public.saturno_finca_estacion_map sfe on sfe.codigo_up = u.codigo_up
  left join public.excel_estaciones_faltantes_map eef on eef.agricultor = ag.nombre
  left join public.excel_up_estacion_map eup on eup.unidad_produccion = u.nombre
  left join public.excel_productor_estacion_map epe on epe.agricultor = ag.nombre
  where s.ciclo_id = v_ciclo_id
  on conflict (lote_id) do update set
    agricultor_id = excluded.agricultor_id,
    nombre_lote = excluded.nombre_lote,
    ciclo = excluded.ciclo,
    hectareas = excluded.hectareas,
    fecha_siembra = coalesce(public.lotes.fecha_siembra, excluded.fecha_siembra),
    ha_sembradas = excluded.ha_sembradas,
    ha_perdidas = excluded.ha_perdidas,
    ha_cosechadas = excluded.ha_cosechadas,
    codigo_estacion = excluded.codigo_estacion;

  perform public.saturno_refrescar_derivados();
end;
$$;

revoke all on function public.saturno_promover_lotes() from public;
grant execute on function public.saturno_promover_lotes() to service_role;
