-- Módulo Documentación, contra el esquema nuevo (agricultores.agricultor_id,
-- lotes.lote_id). Reemplaza el diseño viejo (bucket `analisis-suelo`, tabla
-- `lote_analisis_suelo`, AgricultorKey) por nombres que ya no mienten sobre
-- el alcance: hoy cubre análisis de suelo, convenios, P&L y análisis de datos.
--
-- Correr una sola vez en el SQL Editor del proyecto Supabase NUEVO
-- (igunjudpyndfttujoluj). El bucket `documentos` ya se creó vía Storage API
-- (privado, 20MB máx., pdf/png/jpeg/webp) — este script no lo toca.

create extension if not exists pg_trgm;

-- 1) Tabla ------------------------------------------------------------------

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  agricultor_id uuid not null references public.agricultores(agricultor_id) on delete cascade,
  lote_id uuid references public.lotes(lote_id) on delete set null,
  ciclo text not null,
  categoria text not null check (categoria in ('analisis_suelo', 'convenios', 'pnl', 'analisis_datos')),
  storage_path text not null unique,
  nombre_archivo text not null,
  tamano_bytes bigint,
  es_vigente boolean not null default true,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists documentos_agricultor_ciclo_categoria_idx
  on public.documentos (agricultor_id, ciclo, categoria);

-- 2) RLS de la tabla ----------------------------------------------------
-- Sin políticas de insert/update/delete a propósito: la escritura vive solo
-- en los route handlers con service_role (regla de AGENTS.md), igual que
-- app/api/lote/siembra. Con RLS activo y sin esas políticas, anon/authenticated
-- quedan bloqueados de escribir por default-deny.

alter table public.documentos enable row level security;

create policy documentos_select on public.documentos
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid()
        and (up.role = 'master' or up.agricultor_id = documentos.agricultor_id)
    )
  );

-- 3) RLS de Storage -----------------------------------------------------
-- El path de cada objeto es `${agricultor_id}/${ciclo}/${categoria}/...`, así
-- que el primer segmento decide visibilidad. Necesario porque
-- DocumentoPreviewModal/DocumentoDownloadBtn piden signed URLs directo desde
-- el browser con la sesión del usuario (createSignedUrl exige permiso de
-- SELECT vía RLS sobre storage.objects, no alcanza con que el bucket exista).
-- Igual que en la tabla: sin políticas de insert/update/delete — la escritura
-- y el borrado van por service_role en el servidor.

create policy documentos_storage_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documentos'
    and exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid()
        and (
          up.role = 'master'
          or up.agricultor_id::text = (storage.foldername(name))[1]
        )
    )
  );

-- 4) RPC de sugerencia para el uploader ----------------------------------
-- Reemplaza al match_archivo_a_agricultor viejo (que comparaba contra
-- agropecuaria.nombre_agropecuaria). Solo master puede llamarla: usa
-- security definer para poder comparar contra TODOS los agricultores sin
-- pisar la RLS de cada uno, así que el chequeo de rol queda adentro de la
-- función, no delegado a RLS.

create or replace function public.match_archivo_a_agricultor(filename text)
returns table (agricultor_id uuid, nombre text, ciclo text, similitud real)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_profiles up
    where up.user_id = auth.uid() and up.role = 'master'
  ) then
    return;
  end if;

  return query
  select
    a.agricultor_id,
    a.nombre,
    coalesce(
      (select l.ciclo from public.lotes l
       where l.agricultor_id = a.agricultor_id
       order by l.fecha_siembra desc nulls last
       limit 1),
      to_char(now(), 'YYYY')
    ) as ciclo,
    similarity(a.nombre, filename) as similitud
  from public.agricultores a
  order by similitud desc
  limit 5;
end;
$$;

grant execute on function public.match_archivo_a_agricultor(text) to authenticated;

-- 5) Verificación ---------------------------------------------------------
-- Correr esto último y confirmar que documentos_select devuelve 0 filas (la
-- tabla arranca vacía) sin error de permisos, adoptando la identidad de un
-- agricultor real (mismo patrón que exige AGENTS.md para cualquier tabla/
-- vista con RLS nueva):
--
-- do $$ declare v_uid uuid; begin
--   select user_id into v_uid from user_profiles where agricultor_id='<uuid-de-prueba>' limit 1;
--   perform set_config('request.jwt.claims',
--     json_build_object('sub', v_uid::text, 'role','authenticated')::text, true);
--   perform set_config('role','authenticated', true);
-- end $$;
-- select count(*) from public.documentos;
