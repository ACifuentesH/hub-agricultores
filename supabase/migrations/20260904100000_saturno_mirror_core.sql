-- Reconstrucción del pipeline de sincronización con Saturno (docs/SINCRONIZACION_SATURNO.md),
-- perdido cuando se borró el proyecto original. No tenemos el `saturno.mapa_columnas`
-- original (882 filas curadas a mano) — se reemplaza por una normalización genérica de
-- nombres de columna (lowercase + no-alfanumérico -> "_"), que ya reproduce los dos
-- ejemplos documentados sin ayuda ("Row ID" -> row_id, "HA_Cosechadas" -> ha_cosechadas).
-- Si aparece un caso que la normalización genérica no resuelve bien, se puede sobrescribir
-- editando la columna ya creada a mano — no rompe la ingesta futura (add column if not exists).

create extension if not exists unaccent;
create extension if not exists pg_net;

create schema if not exists saturno;

-- El esquema saturno.* es solo de ingesta: cerrado a anon/authenticated (RLS sin
-- políticas), igual que exige AGENTS.md para el espejo.
revoke all on schema saturno from anon, authenticated;

-- 1) Normalización de nombres de columna -------------------------------------

create or replace function saturno.normalizar_columna(p text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(lower(btrim(p)), '[^a-z0-9]+', '_', 'g'),
      '(^_+|_+$)', '', 'g'
    ),
    ''
  )
$$;

-- 2) Bitácora de sincronización ------------------------------------------------

create table if not exists saturno.sync_log (
  id bigint generated always as identity primary key,
  volcado text,
  tabla text not null,
  filas integer,
  ok boolean not null,
  error text,
  duracion_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists sync_log_created_at_idx on saturno.sync_log (created_at desc);
create index if not exists sync_log_volcado_idx on saturno.sync_log (volcado);

alter table saturno.sync_log enable row level security;
-- sin políticas: default-deny para anon/authenticated, solo service_role (bypassa RLS)

-- 3) Alias de productor (nombres que no casan por key/tokens) -----------------
-- Referencia directa a agricultores.agricultor_id (uuid) — a diferencia del
-- esquema viejo, que usaba un AgricultorKey de texto.

create table if not exists saturno.alias_productor (
  nombre_saturno text primary key,
  agricultor_id uuid not null references public.agricultores (agricultor_id),
  motivo text
);

alter table saturno.alias_productor enable row level security;

-- 4) Ingesta genérica -----------------------------------------------------------
-- Crea la tabla espejo si no existe (row_id text primary key) y agrega columnas
-- nuevas sobre la marcha (todo TEXT) para cualquier campo que traiga el volcado,
-- tal como exige el punto "si Saturno agrega una columna, la carga no se rompe".

create or replace function public.saturno_ingerir(p_tabla text, p_filas jsonb, p_volcado text default null)
returns void
language plpgsql
security definer
set search_path = public, saturno
as $$
declare
  v_raw_key text;
  v_norm_key text;
  v_row_id_raw_key text;
  v_cols text[] := array[]::text[];
  v_raw_for_col jsonb := '{}'::jsonb;
  v_insert_list text;
  v_select_list text;
  v_update_list text;
  v_sql text;
  v_inicio timestamptz := clock_timestamp();
begin
  if p_tabla !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'Nombre de tabla invalido: %', p_tabla;
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    return;
  end if;

  execute format('create table if not exists saturno.%I (row_id text primary key)', p_tabla);

  for v_raw_key in
    select distinct k
    from jsonb_array_elements(p_filas) as elem, jsonb_object_keys(elem) as k
  loop
    v_norm_key := saturno.normalizar_columna(v_raw_key);
    if v_norm_key is null then
      continue;
    end if;

    if v_norm_key = 'row_id' then
      v_row_id_raw_key := coalesce(v_row_id_raw_key, v_raw_key);
    elsif not (v_norm_key = any(v_cols)) then
      v_cols := v_cols || v_norm_key;
      v_raw_for_col := v_raw_for_col || jsonb_build_object(v_norm_key, v_raw_key);
      execute format('alter table saturno.%I add column if not exists %I text', p_tabla, v_norm_key);
    end if;
  end loop;

  if v_row_id_raw_key is null then
    raise exception 'saturno_ingerir(%): el volcado no trae "Row ID"', p_tabla;
  end if;

  select
    string_agg(format('%I', c), ', '),
    string_agg(format('r ->> %L', v_raw_for_col ->> c), ', '),
    string_agg(format('%I = excluded.%I', c, c), ', ')
  into v_insert_list, v_select_list, v_update_list
  from unnest(v_cols) as c;

  v_sql := format(
    'insert into saturno.%I (row_id%s) select r ->> %L%s from jsonb_array_elements($1) r on conflict (row_id) do update set %s',
    p_tabla,
    case when v_insert_list is not null then ', ' || v_insert_list else '' end,
    v_row_id_raw_key,
    case when v_select_list is not null then ', ' || v_select_list else '' end,
    coalesce(v_update_list, 'row_id = excluded.row_id')
  );

  execute v_sql using p_filas;

  insert into saturno.sync_log (volcado, tabla, filas, ok, duracion_ms, created_at)
  values (p_volcado, p_tabla, jsonb_array_length(p_filas), true,
          extract(epoch from (clock_timestamp() - v_inicio)) * 1000, now());
exception when others then
  insert into saturno.sync_log (volcado, tabla, filas, ok, error, duracion_ms, created_at)
  values (p_volcado, p_tabla, jsonb_array_length(p_filas), false, sqlerrm,
          extract(epoch from (clock_timestamp() - v_inicio)) * 1000, now());
  raise;
end;
$$;

revoke all on function public.saturno_ingerir(text, jsonb, text) from public;
grant execute on function public.saturno_ingerir(text, jsonb, text) to service_role;

create or replace function public.saturno_ya_sincronizado(p_volcado text)
returns boolean
language sql
stable
security definer
set search_path = public, saturno
as $$
  select count(distinct tabla) >= 50
  from saturno.sync_log
  where volcado = p_volcado and ok = true
$$;

revoke all on function public.saturno_ya_sincronizado(text) from public;
grant execute on function public.saturno_ya_sincronizado(text) to service_role;

-- 5) Utilidades de fecha y de nombre de productor ------------------------------

create or replace function public.saturno_fecha(p text)
returns date
language plpgsql
immutable
as $$
begin
  if p is null or btrim(p) = '' or upper(btrim(p)) in ('N/A', 'NA', 'NULL') then
    return null;
  end if;
  return to_date(btrim(p), 'MM/DD/YYYY');
exception when others then
  return null;
end;
$$;

create or replace function public.saturno_key(p text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(unaccent(coalesce(p, '')), '[^a-zA-Z]', '', 'g'))
$$;

create or replace function public.saturno_tokens(p text)
returns text
language sql
immutable
as $$
  select coalesce(
    (select string_agg(t, ' ' order by t)
     from unnest(regexp_split_to_array(upper(unaccent(coalesce(p, ''))), '[^A-Z]+')) as t
     where t <> ''),
    ''
  )
$$;

-- 6) Config S3 desde Vault + setter (para no commitear el secreto en texto plano) --

create or replace function public.saturno_config()
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'saturno_s3'
  limit 1;

  if v_secret is null then
    raise exception 'Secreto saturno_s3 no configurado en Vault';
  end if;

  return v_secret::jsonb;
end;
$$;

revoke all on function public.saturno_config() from public;
grant execute on function public.saturno_config() to service_role;

create or replace function public.saturno_set_s3_secret(p_config jsonb)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'saturno_s3';
  if v_id is null then
    perform vault.create_secret(p_config::text, 'saturno_s3');
  else
    perform vault.update_secret(v_id, p_config::text);
  end if;
end;
$$;

revoke all on function public.saturno_set_s3_secret(jsonb) from public;
grant execute on function public.saturno_set_s3_secret(jsonb) to service_role;

-- 7) Disparo del sync (invoca la edge function vía pg_net) --------------------
-- Mismo patrón que sync_all_stations() del pipeline de clima (ver
-- docs/MIGRACION_SUPABASE_ORG.md §4): project_url y anon key hardcodeados en el
-- cuerpo. El anon key es público por diseño — si se rota, hay que actualizar
-- esta función también.

create or replace function public.saturno_disparar_sync()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://fsbighencuhalvrdxiga.supabase.co/functions/v1/saturno-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYmlnaGVuY3VoYWx2cmR4aWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTkwMDMsImV4cCI6MjEwMjYzNTAwM30.okwuvnjD29y93gvWIoW9-8cPbSPRR-TqDnx_8RLhHeY'
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.saturno_disparar_sync() from public;
grant execute on function public.saturno_disparar_sync() to service_role;

-- 8) Salud del pipeline ---------------------------------------------------------
-- Diagnóstico, no alimenta pantallas de la app (por eso no importa que
-- security_invoker deje esto en 0 filas si lo consulta un rol sin acceso a
-- saturno.* — se corre desde el SQL Editor o con service_role).

create or replace view public.v_saturno_salud
with (security_invoker = true) as
select
  (select max(created_at) from saturno.sync_log) as ultimo_sync,
  extract(epoch from (now() - (select max(created_at) from saturno.sync_log))) / 3600
    as horas_desde_ultimo_sync,
  (select count(*) from saturno.sync_log
     where created_at > now() - interval '1 day' and ok) as tablas_ok_24h,
  (select count(*) from saturno.sync_log
     where created_at > now() - interval '1 day' and not ok) as tablas_error_24h,
  (select count(*) from public.lotes) as lotes_ciclo_activo;
