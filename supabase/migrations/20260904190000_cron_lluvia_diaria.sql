-- Cron de refresco de lluvia_diaria_estacion (docs/MIGRACION_SUPABASE_ORG.md
-- §5, cada 15 min) — sin esto, el gap que se acaba de rellenar con el
-- backfill vuelve a abrirse apenas entren lecturas nuevas.

select cron.unschedule('refrescar-lluvia-diaria')
where exists (select 1 from cron.job where jobname = 'refrescar-lluvia-diaria');

select cron.schedule(
  'refrescar-lluvia-diaria',
  '*/15 * * * *',
  $$select public.refrescar_lluvia_diaria_estacion(3)$$
);
