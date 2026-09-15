-- Salud de estaciones (bateria/wifi) cada hora, alineado con
-- sync-weatherlink-hourly del modulo de clima (min 5 de cada hora) -- se
-- corre 3 min despues para no competir por el mismo cupo de la API de
-- WeatherLink al mismo tiempo.

select cron.unschedule('weatherlink-salud-sync-hourly')
where exists (select 1 from cron.job where jobname = 'weatherlink-salud-sync-hourly');

select cron.schedule(
  'weatherlink-salud-sync-hourly',
  '8 * * * *',
  $$select net.http_post(
      url := 'https://fsbighencuhalvrdxiga.supabase.co/functions/v1/weatherlink-salud-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYmlnaGVuY3VoYWx2cmR4aWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTkwMDMsImV4cCI6MjEwMjYzNTAwM30.okwuvnjD29y93gvWIoW9-8cPbSPRR-TqDnx_8RLhHeY'
      ),
      body := '{}'::jsonb
    )$$
);
