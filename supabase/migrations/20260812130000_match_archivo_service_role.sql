-- Fix: match_archivo_a_agricultor() sólo dejaba pasar a `role='master'` vía
-- auth.uid() (sesión de browser). Los scripts de import masivo la llaman con
-- service_role (sin sesión, auth.uid() es null), así que siempre volvía []
-- aunque el llamado fuera legítimo. Se agrega el caso service_role, que ya
-- es de por sí un contexto totalmente confiable (bypassa RLS en todo lo demás).
--
-- Correr en el SQL Editor del proyecto NUEVO, después de
-- 20260812120000_documentos_module.sql.

create or replace function public.match_archivo_a_agricultor(filename text)
returns table (agricultor_id uuid, nombre text, ciclo text, similitud real)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not exists (
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
