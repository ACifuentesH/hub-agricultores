-- Reconstrucción del esquema núcleo (login + lotes) tras el borrado accidental
-- del proyecto Supabase "grAIn-satelite-clima" (recreado con ref nuevo,
-- fsbighencuhalvrdxiga). `agricultores` ya existía (id, id_saturno, nombre,
-- created_at) porque el pipeline de clima sigue vivo — NO se toca esa columna
-- `id` para no romper las tablas puente de clima (mapa_productor_clima,
-- agricultor_lluvia_map, etc.), que ya la referencian.
--
-- `agricultor_id` se agrega como columna generada (alias de `id`) para que el
-- código de la app, que en todos lados usa el nombre `agricultor_id`, funcione
-- sin reescribir el pipeline de clima.

-- 1) agricultores: alias + cédula ------------------------------------------

alter table public.agricultores
  add column if not exists agricultor_id uuid generated always as (id) stored;

alter table public.agricultores
  add column if not exists cedula text;

create unique index if not exists agricultores_agricultor_id_key
  on public.agricultores (agricultor_id);

create unique index if not exists agricultores_cedula_key
  on public.agricultores (cedula) where cedula is not null;

alter table public.agricultores enable row level security;

drop policy if exists agricultores_select on public.agricultores;
create policy agricultores_select on public.agricultores
  for select to authenticated
  using (true);

-- 2) user_profiles (antes que `lotes`: su policy de select depende de esta tabla) --

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('master', 'farmer')),
  agricultor_id uuid references public.agricultores (agricultor_id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists user_profiles_agricultor_id_idx
  on public.user_profiles (agricultor_id) where agricultor_id is not null;

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own on public.user_profiles
  for select to authenticated
  using (user_id = auth.uid());

-- 3) lotes -------------------------------------------------------------------

create table if not exists public.lotes (
  lote_id uuid primary key default gen_random_uuid(),
  agricultor_id uuid not null references public.agricultores (agricultor_id) on delete cascade,
  nombre_lote text not null,
  ciclo text not null,
  hectareas numeric,
  cultivo text,
  fecha_siembra date,
  fecha_cosecha_estimada date,
  fecha_cosecha_real date,
  ha_sembradas numeric,
  ha_perdidas numeric,
  ha_cosechadas numeric,
  estado_lote text,
  codigo_estacion text,
  created_at timestamptz not null default now()
);

create index if not exists lotes_agricultor_ciclo_idx on public.lotes (agricultor_id, ciclo);
create index if not exists lotes_codigo_estacion_idx on public.lotes (codigo_estacion) where codigo_estacion is not null;

alter table public.lotes enable row level security;

drop policy if exists lotes_select on public.lotes;
create policy lotes_select on public.lotes
  for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid()
        and (up.role = 'master' or up.agricultor_id = lotes.agricultor_id)
    )
  );

-- 4) lote_eventos (bitácora de cambios manuales, alimenta la campana) --------

create table if not exists public.lote_eventos (
  id uuid primary key default gen_random_uuid(),
  agricultor_id uuid not null references public.agricultores (agricultor_id) on delete cascade,
  lote_id uuid references public.lotes (lote_id) on delete set null,
  lote_nombre text,
  ciclo text,
  tipo text not null,
  valor_anterior text,
  valor_nuevo text,
  usuario_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lote_eventos_agricultor_ciclo_created_idx
  on public.lote_eventos (agricultor_id, ciclo, created_at desc);

alter table public.lote_eventos enable row level security;

drop policy if exists lote_eventos_select on public.lote_eventos;
create policy lote_eventos_select on public.lote_eventos
  for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid()
        and (up.role = 'master' or up.agricultor_id = lote_eventos.agricultor_id)
    )
  );

-- Nota: sin políticas de insert/update/delete a propósito (regla de AGENTS.md
-- "Escrituras solo por service_role") — con RLS activo y sin esas políticas,
-- anon/authenticated quedan bloqueados de escribir por default-deny.
