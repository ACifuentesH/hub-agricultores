-- Mismo patron que saturno-sync-6h: corre 5 min despues para que ya haya
-- terminado el sync principal. La propia edge function encadena
-- saturno_refrescar_derivados() al final (ver su codigo), asi que
-- avance_pct/rendimiento_kg_ha quedan al dia sin depender de un segundo
-- paso en el cron.

select cron.unschedule('grain-rendimiento-sync-6h')
where exists (select 1 from cron.job where jobname = 'grain-rendimiento-sync-6h');

select cron.schedule(
  'grain-rendimiento-sync-6h',
  '25 5,11,17,23 * * *',
  $$select net.http_post(
      url := 'https://fsbighencuhalvrdxiga.supabase.co/functions/v1/grain-estimaciones-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYmlnaGVuY3VoYWx2cmR4aWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTkwMDMsImV4cCI6MjEwMjYzNTAwM30.okwuvnjD29y93gvWIoW9-8cPbSPRR-TqDnx_8RLhHeY'
      ),
      body := '{}'::jsonb
    )$$
);
