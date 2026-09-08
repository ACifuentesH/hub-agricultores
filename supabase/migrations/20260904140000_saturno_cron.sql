-- Cron de sincronización con Saturno (docs/SINCRONIZACION_SATURNO.md §2, §5):
-- 4 volcados diarios de Saturno (~04:52, 10:52, 16:52, 22:52 UTC), el cron
-- corre 20-30 min después de cada uno para darle margen a que termine de
-- publicar. saturno_disparar_sync() invoca la edge function, que ingiere y
-- (si se le pide promover:true) reconstruye public.lotes — acá se dispara
-- sync + promoción encadenados en un solo job.

create extension if not exists pg_cron;

select cron.unschedule('saturno-sync-6h')
where exists (select 1 from cron.job where jobname = 'saturno-sync-6h');

select cron.schedule(
  'saturno-sync-6h',
  '20 5,11,17,23 * * *',
  $$select net.http_post(
      url := 'https://fsbighencuhalvrdxiga.supabase.co/functions/v1/saturno-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYmlnaGVuY3VoYWx2cmR4aWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTkwMDMsImV4cCI6MjEwMjYzNTAwM30.okwuvnjD29y93gvWIoW9-8cPbSPRR-TqDnx_8RLhHeY'
      ),
      body := '{"promover": true}'::jsonb
    )$$
);
