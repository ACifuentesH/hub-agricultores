-- Salud física de las estaciones Davis: batería del transmisor (ISS) y señal
-- wifi de la consola (WeatherLink Live), pedido por el usuario para el
-- dashboard. Confirmado contra el payload real de /v2/current/{station_id}
-- (sensor_type 53 trae trans_battery_flag/rx_state, sensor_type 504 trae
-- wifi_rssi/link_uptime) -- no estaba siendo capturado por ningún sync
-- existente.

create table if not exists public.estaciones_salud (
  codigo_estacion text primary key references public.estaciones (codigo_estacion) on delete cascade,
  wifi_rssi integer,       -- dBm, mientras mas cercano a 0 mejor señal (consola WeatherLink Live)
  trans_battery_flag integer, -- 0 = bateria del transmisor ok, 1 = baja
  rx_state integer,        -- estado de recepcion del transmisor (ISS)
  link_uptime_s integer,   -- segundos desde el ultimo reinicio de red de la consola
  synced_at timestamptz not null default now()
);

alter table public.estaciones_salud enable row level security;

drop policy if exists estaciones_salud_select on public.estaciones_salud;
create policy estaciones_salud_select on public.estaciones_salud
  for select to authenticated
  using (true); -- mismo criterio que el resto de las tablas de clima (dato operativo, no de negocio)

revoke all on table public.estaciones_salud from anon;
grant select on table public.estaciones_salud to authenticated;
grant all on table public.estaciones_salud to service_role;
