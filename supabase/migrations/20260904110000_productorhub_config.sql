-- productorhub_config(): credenciales S3 del bucket `productorhub` (proyecto
-- nwouogywyofnvxsgjttd, del equipo que va a heredar la plataforma), usadas
-- por lib/productorhub-storage.ts. Mismo patrón que saturno_config().

create or replace function public.productorhub_config()
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
  where name = 'productorhub_s3'
  limit 1;

  if v_secret is null then
    raise exception 'Secreto productorhub_s3 no configurado en Vault';
  end if;

  return v_secret::jsonb;
end;
$$;

revoke all on function public.productorhub_config() from public;
grant execute on function public.productorhub_config() to service_role;

create or replace function public.productorhub_set_s3_secret(p_config jsonb)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'productorhub_s3';
  if v_id is null then
    perform vault.create_secret(p_config::text, 'productorhub_s3');
  else
    perform vault.update_secret(v_id, p_config::text);
  end if;
end;
$$;

revoke all on function public.productorhub_set_s3_secret(jsonb) from public;
grant execute on function public.productorhub_set_s3_secret(jsonb) to service_role;
