# Migración de lluvia/WeatherLink a la Supabase organizacional

Inventario y procedimiento para mover el módulo de clima (estaciones Davis vía
WeatherLink + predicción/lluvia por lote) del proyecto Supabase personal
(`ovcrjupneetifjasecko`, "Polar en el campo") a un proyecto de la organización.

Generado el 06-ago-2026 contra el estado real de la base — no contra lo que
dicen los otros documentos, que en un punto están desactualizados (ver §0).

Para entender **por qué** el pipeline está armado así, ver
[INTEGRACION_WEATHERLINK.md](INTEGRACION_WEATHERLINK.md) y
[OPERACION_PIPELINE_CLIMA.md](OPERACION_PIPELINE_CLIMA.md). Este documento es
solo el **runbook de migración**.

---

## 0. Hallazgo antes de empezar: no son dos proyectos, son uno

`INTEGRACION_WEATHERLINK.md` documenta el pipeline como repartido entre dos
proyectos Supabase (`agri-platform` y `seguimiento-lluvia-saturno`) conectados
por un puente (`agricultor_lluvia_map`). **Verificado en vivo (06-ago-2026):
las tablas de ambos "proyectos" viven hoy en la misma base**
(`ovcrjupneetifjasecko`) — `weather_readings` y `lotes_seguimiento_lluvia`
están en el mismo `public`. Buena noticia para la migración: **es un solo
`pg_dump`, no hay que coordinar dos bases**. Si esto no coincide con lo que
esperabas, confírmalo antes de seguir — puede que la consolidación haya
pasado sin que quedara documentada.

---

## 1. Alcance: qué se migra y qué no

Se migra **todo lo relacionado a clima/lluvia**. Explícitamente **NO** se
migra: `lote`, `agropecuaria`, `insumos`, `mecanizacion_registro`,
`pl_unidad`, el esquema `saturno.*`, ni nada del resto de las ~49 tablas de
`public` del proyecto actual — eso sigue siendo Saturno, fuera de este
alcance.

**Dependencia cruzada que hay que resolver antes de migrar** (no es opcional):
las políticas RLS de `clima_forecast` y `clima_lecturas` filtran por
`auth.uid()` contra `user_profiles` (tabla de autenticación de la app, fuera
del alcance de este documento):

```sql
qual: "productor_clima IN (SELECT productor_clima FROM mapa_productor_clima
       WHERE agricultor_key IN (SELECT agricultor_key FROM user_profiles
       WHERE user_id = auth.uid()))"
```

Si el proyecto organizacional no tiene `user_profiles`/`agricultor_key` con
los mismos valores, esas dos políticas devuelven cero filas a todo el mundo
(el mismo síntoma que describe `AGENTS.md` para `saturno.*`). Decide antes de
migrar: ¿el proyecto destino comparte el modelo de auth de Saturno, o hay que
reescribir esas dos políticas contra otra cosa (`anon`/`authenticated` de
lectura pública, como ya tienen la mayoría de las tablas de este módulo)?

---

## 2. Inventario — tablas (con filas al 06-ago-2026)

### Unidad A — núcleo WeatherLink (estaciones Davis → `weather_readings`)

| Tabla | Filas | Notas |
|---|---:|---|
| `weather_readings` | 1.379.963 | La grande. PK `id`, único `(station_id, ts)`. |
| `sync_status` | 45 | Cursor de sincronización por estación. PK `station_id`. |
| `load_historic_queue` | 896 | Cola de backfill. Único `(station_id, year, month)`. |
| `estaciones_davis` | 44 | Catálogo con coords. |
| `estaciones_coordenadas` | 45 | Catálogo alterno (usado por `triangulate_clima`). |
| `mapa_productor_clima` | 83 | Overrides agricultor↔estación. |

### Unidad B — lluvia por lote / predicción / satelital

| Tabla | Filas | Notas |
|---|---:|---|
| `clima_diario_raw` | 243.898 | |
| `clima_lecturas` | 241.417 | RLS por `auth.uid()` — ver §1. |
| `clima_historico_global` | 29.471 | NASA POWER, poblada por `descargar-clima-historico`. |
| `chirps_lluvia` | 5.840 | Satelital. |
| `lluvia_diaria_estacion` | 13.445 | Refrescada por cron cada 15 min. |
| `resumen_mensual_estacion` | 533 | |
| `prediccion_estacion_cache` | 324 | |
| `clima_forecast` | 224 | Pronóstico 16 días, Open-Meteo. RLS por `auth.uid()` — ver §1. |
| `enso_index` | 316 | ONI mensual. |
| `modis_ndvi` | 384 | |
| `productor_coordenadas` | 57 | |
| `lotes_seguimiento_lluvia` | 264 | Escritura abierta a `authenticated` (`ALL`, `qual=true`) — revisar si eso se quiere conservar en el proyecto nuevo. |
| `agricultor_lluvia_map` | 35 | El puente mencionado en §0. |
| `estaciones_zona` | 27 | |
| `muestras_lluvia_periodo_anual` | 41 | |
| `clima_percentiles_enso` | 0 | Vacía hoy; existe la función `recalcular_percentiles_enso()` para poblarla. |

**No copiadas en el inventario de arriba pero referenciadas por las funciones
de predicción** (confirmar con `\df` antes del dump — no alcanzó a extraerlas
esta pasada): `prediccion_estacion()`, `prediccion_zona()`,
`prediccion_zona_cache`, `get_davis_daily()`, `get_davis_rain_only()`,
`get_monthly_avg_temp()`, `recalcular_percentiles_enso()`. Si migras la
Unidad B, estas van con ella — son las que usan `clima-promedio-export` y
`lluvia-distribucion`.

---

## 3. Vistas

| Vista | Unidad |
|---|---|
| `v_clima_efectivo` | A — la consume `lib/clima.ts` y los chips de `/master` |
| `v_estaciones_clima` | A |
| `v_pipeline_health` | A — dashboard de salud del pipeline |
| `vista_lluvia_diaria_lote`, `vista_lluvia_mensual_lote` | B |
| `vista_lluvia_mensual_zona` | B |
| `vista_prediccion_lluvia_lote`, `vista_prediccion_lluvia_zona` | B |
| `vista_seguimiento_lluvia` | B |
| `vista_distribucion_normal_lluvia` | B |
| `vista_lluvia_diaria_estacion` | B |
| `lluvia_davis_pct`, `lluvia_davis_semanal` | B |
| `perfil_climatico_optimo`, `cruce_clima_rendimiento` | B — estas cruzan con datos de rendimiento/cultivo, confirmar si dependen de tablas fuera de este alcance antes de copiarlas |

`v_pipeline_health_detalle`, mencionada en `OPERACION_PIPELINE_CLIMA.md`, no
apareció en la consulta en vivo contra `information_schema.views` — puede
tener otro nombre hoy o haberse retirado. Verificar antes de asumir que existe.

**Todas deben quedar con `security_invoker = true`** en el destino — es la
regla de `AGENTS.md` para que la RLS del que consulta aplique. `pg_dump`
preserva esto automáticamente si lo tenían en origen.

---

## 4. Funciones — DDL ya extraído

Las funciones que orquestan el pipeline (útil tenerlas a mano para no
depender de que `pg_dump` corra limpio en el primer intento):

- `sync_all_stations()` — dispara `weatherlink-sync` para cada estación
  vencida. **Ojo: trae hardcodeados `project_url` y el `anon_key` del
  proyecto actual** dentro del cuerpo de la función (no es un secreto grave —
  el anon key es público por diseño — pero en el proyecto nuevo hay que
  reemplazar ambos valores por los del proyecto destino, o la función seguirá
  llamando al proyecto viejo).
- `process_load_historic_queue()` — toma 1 job de la cola y llama
  `wl-load-historic` vía `net.http_post`. También tiene la URL del proyecto
  hardcodeada.
- `enqueue_incomplete_months()` — re-encola meses con `temp_c IS NULL`.
- `refrescar_lluvia_diaria_estacion(p_dias_atras int)`,
  `refrescar_resumen_mensual_estacion()`, `refrescar_prediccion_cache()` —
  Unidad B.
- `triangulate_clima(lat, lon, k, max_dist_km)` — IDW, **dormida** desde el
  30-jul-2026 (ver AGENTS.md), pero se conserva por si se revierte esa
  decisión. Depende de `postgis` (`geography`, `st_distance`, `<->`).

Todas usan `SET search_path` fijado (hardening del 11-jun-2026) — mantenerlo
al recrearlas en destino.

---

## 5. Cron jobs (`pg_cron`)

| Job | Schedule | Comando | Unidad |
|---|---|---|---|
| `sync-weatherlink-hourly` | `5 * * * *` | `SELECT public.sync_all_stations()` | A |
| `wl-load-historic-runner` | `* * * * *` | `SELECT process_load_historic_queue()` | A |
| `enqueue-incomplete-months-daily` | `0 3 * * *` | `SELECT public.enqueue_incomplete_months()` | A |
| `trueup-sync-counters` | `40 4 * * *` | UPDATE inline que cuadra `sync_status.total_records` contra `weather_readings` (ver SQL abajo) | A |
| `refrescar-lluvia-diaria` | `*/15 * * * *` | 3 llamadas: `refrescar_lluvia_diaria_estacion(3)`, `refrescar_resumen_mensual_estacion()`, `refrescar_prediccion_cache()` | B |

`trueup-sync-counters` completo (no es una función, es SQL inline en el cron):

```sql
update sync_status ss
set total_records = c.n
from (select station_id, count(*) as n from weather_readings group by station_id) c
where c.station_id = ss.station_id
  and ss.total_records is distinct from c.n
```

**No lleva `saturno-sync-6h`** (jobid 9) — eso es Saturno, fuera de alcance.

Los `jobid` no se preservan al recrear con `cron.schedule()` en el proyecto
nuevo — no dependas de esos números en ningún sitio nuevo.

---

## 6. Edge Functions

Hasta hoy vivían **solo desplegadas**, sin código en el repo. Se agregó
`supabase/functions/<slug>/index.ts` con el fuente de cada una para que la
migración no dependa de copiar y pegar desde el dashboard:

| Slug | Unidad | Usada por cron | Env vars que necesita |
|---|---|---|---|
| `weatherlink-sync` | A | `sync-weatherlink-hourly` (vía `sync_all_stations()`) | `WEATHERLINK_API_KEY`, `WEATHERLINK_API_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `wl-load-historic` | A | `wl-load-historic-runner` (vía `process_load_historic_queue()`) | mismas 4 + tiene el catálogo `STATIONS` **hardcodeado y desactualizado** (28 estaciones; el catálogo real hoy tiene 44) — regenerarlo antes de redeployar, ver comentario en el archivo |
| `wl-sync-bulk` | A | No la llama ningún cron — invocación manual/diagnóstico | `WEATHERLINK_API_KEY/SECRET` |
| `weatherlink-historic` | A | No | `WEATHERLINK_API_KEY/SECRET` |
| `weatherlink-stations` | A | No — lista `/v2/stations`, útil para auditar el catálogo | `WEATHERLINK_API_KEY/SECRET` |
| `weatherlink-bootstrap` | A | No — carga inicial masiva, ya no se usa en operación normal | 4 vars completas |
| `clima-promedio-export` | B | No — la consume el front bajo demanda | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `lluvia-distribucion` | B | No | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `descargar-clima-historico` | B | No — se corre a mano para poblar NASA POWER/forecast/ENSO | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

**Deliberadamente no copiadas** (diagnóstico/temporal, no forman parte del
pipeline en producción): `wl-debug-sensors`, `wl-stations-temp`,
`davis-raw-query`. Si las necesitas, están en el proyecto origen vía
`get_edge_function` del MCP de Supabase — pero no bloquean la migración.

Con el código ya en el repo, el despliegue al proyecto nuevo es:

```bash
supabase link --project-ref <ref-proyecto-organizacional>
supabase functions deploy weatherlink-sync
supabase functions deploy wl-load-historic
supabase functions deploy wl-sync-bulk
supabase functions deploy weatherlink-historic
supabase functions deploy weatherlink-stations
supabase functions deploy weatherlink-bootstrap
supabase functions deploy clima-promedio-export
supabase functions deploy lluvia-distribucion
supabase functions deploy descargar-clima-historico
```

---

## 7. Extensiones que debe tener el proyecto destino

```
pg_cron, pg_net, postgis, pg_trgm, pgcrypto, uuid-ossp
```

(`supabase_vault`, `vector`, `pg_stat_statements` también están en origen
pero no las usa este módulo — no son requisito para esta migración
específica.) `postgis` es la que más fácil se olvida: sin ella
`triangulate_clima()` no compila (usa `geography`, `st_distance`, `<->`).

---

## 8. Secrets a configurar en el proyecto destino

**Edge Function Secrets** (Studio → Settings → Edge Functions → Secrets, no
Vault):

- `WEATHERLINK_API_KEY`
- `WEATHERLINK_API_SECRET`

(`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase
automáticamente en cada función — no hay que setearlos a mano.)

**Vault**: revisado en origen — solo tiene `productorhub_s3` y `saturno_s3`,
ninguno de los dos usado por este módulo. No hay nada de Vault que migrar
para clima/lluvia.

**Importante — misma cuenta WeatherLink o cuenta nueva:** si el proyecto
organizacional va a seguir leyendo las **mismas 44 estaciones Davis** de la
cuenta WeatherLink actual, la API key/secret son los mismos valores que ya
están en `.env.local` de este repo (`WEATHERLINK_API_KEY`,
`WEATHERLINK_API_SECRET`) — cópialos al nuevo proyecto, no los regeneres a
menos que quieras invalidar el acceso del proyecto viejo también.

---

## 9. RLS — qué replicar

La mayoría de las tablas de este módulo son de **lectura pública** para
`anon`/`authenticated` (es data de clima, no de negocio):
`estaciones_davis`, `estaciones_coordenadas`, `estaciones_zona`,
`sync_status`, `weather_readings`, `mapa_productor_clima`,
`lluvia_diaria_estacion`, `resumen_mensual_estacion`,
`prediccion_estacion_cache`, `productor_coordenadas`, `chirps_lluvia`,
`modis_ndvi`, `enso_index`, `clima_diario_raw`, `clima_percentiles_enso`,
`agricultor_lluvia_map`, `muestras_lluvia_periodo_anual`. Escritura: solo
`service_role` donde está explícito (`weather_readings`, `sync_status`); el
resto no tiene política de escritura para `anon`/`authenticated`, lo cual ya
las protege por default-deny de RLS.

Dos excepciones a vigilar:

1. **`clima_forecast` y `clima_lecturas`** — filtran por `auth.uid()` contra
   `user_profiles`. Ver §1: hay que decidir esto antes de migrar, no
   después.
2. **`lotes_seguimiento_lluvia`** — política `ALL` con `qual=true` para
   `authenticated`: cualquier usuario logueado puede escribir cualquier fila,
   no solo las suyas. Es el comportamiento actual en producción; solo
   señalarlo para que la réplica sea a propósito y no por descuido del dump.

`pg_dump --schema-only` con `-x`/sin `-x` según corresponda preserva las
políticas tal cual — no hace falta reescribirlas a mano salvo el caso de
`user_profiles` de arriba.

---

## 10. Procedimiento recomendado

Dump/restore nativo de Postgres, no el export de Studio (no permite filtrar
por objeto). `weather_readings` con 1.38M filas hace que el dump no sea
instantáneo — usar formato custom (`-Fc`) para que sea comprimido y
restaurable en paralelo.

### Paso 0 — crear el proyecto destino y preparar extensiones

En el dashboard del proyecto organizacional, o vía el MCP de Supabase si el
proyecto ya existe y está conectado: habilitar `pg_cron`, `pg_net`, `postgis`,
`pg_trgm`, `pgcrypto`, `uuid-ossp` (§7) **antes** de restaurar el schema —
si el dump trae objetos que dependen de `postgis` y la extensión no existe
todavía, el restore falla en esos objetos puntuales.

### Paso 1 — dump del schema (DDL) de la Unidad A + B

```bash
# Connection string de origen: Settings → Database → Connection string (modo "URI", puerto 5432 directo o 6543 pooler transaction)
PGPASSWORD='<password-origen>' pg_dump \
  --host=db.ovcrjupneetifjasecko.supabase.co --port=5432 --username=postgres --dbname=postgres \
  --schema-only --no-owner --no-privileges \
  -t public.weather_readings -t public.sync_status -t public.load_historic_queue \
  -t public.estaciones_davis -t public.estaciones_coordenadas -t public.mapa_productor_clima \
  -t public.clima_diario_raw -t public.clima_lecturas -t public.clima_historico_global \
  -t public.chirps_lluvia -t public.lluvia_diaria_estacion -t public.resumen_mensual_estacion \
  -t public.prediccion_estacion_cache -t public.clima_forecast -t public.enso_index \
  -t public.modis_ndvi -t public.productor_coordenadas -t public.lotes_seguimiento_lluvia \
  -t public.agricultor_lluvia_map -t public.estaciones_zona -t public.muestras_lluvia_periodo_anual \
  -t public.clima_percentiles_enso \
  -f clima_schema.sql
```

`-t` solo trae tablas/vistas/secuencias, **no funciones**. Las funciones
(§4, más `prediccion_estacion`, `prediccion_zona`, `get_davis_daily`,
`get_davis_rain_only`, `get_monthly_avg_temp`, `recalcular_percentiles_enso`,
`triangulate_clima`) y las vistas que dependen de ellas hay que traerlas por
fuera: la vía confiable es un dump completo de `--schema-only -n public` y
recortar a mano los bloques `CREATE FUNCTION`/`CREATE VIEW` por nombre (ya
tenés la lista completa en §3–4), o pedirle a alguien con acceso psql que
corra `\ef <función>` por cada una y las pegue en un `.sql` aparte.

### Paso 2 — aplicar el schema en destino

Editar `clima_schema.sql` para:
- Quitar cualquier `CREATE SCHEMA public` / `COMMENT ON SCHEMA` si ya existe.
- Reemplazar el `project_url`/`anon_key` hardcodeado en `sync_all_stations()`
  y `process_load_historic_queue()` (§4) por los del proyecto destino.

```bash
PGPASSWORD='<password-destino>' psql \
  --host=db.<ref-destino>.supabase.co --port=5432 --username=postgres --dbname=postgres \
  -f clima_schema.sql
```

### Paso 3 — copiar datos (tabla por tabla, empezando por las chicas)

```bash
for t in sync_status load_historic_queue estaciones_davis estaciones_coordenadas \
         mapa_productor_clima agricultor_lluvia_map estaciones_zona productor_coordenadas \
         enso_index modis_ndvi muestras_lluvia_periodo_anual clima_percentiles_enso \
         resumen_mensual_estacion prediccion_estacion_cache clima_forecast \
         lluvia_diaria_estacion chirps_lluvia clima_historico_global \
         lotes_seguimiento_lluvia clima_diario_raw clima_lecturas weather_readings; do
  echo "Copiando $t..."
  PGPASSWORD='<password-origen>' pg_dump \
    --host=db.ovcrjupneetifjasecko.supabase.co --port=5432 --username=postgres --dbname=postgres \
    --data-only --no-owner -t "public.$t" -Fc -f "/tmp/$t.dump"
  PGPASSWORD='<password-destino>' pg_restore \
    --host=db.<ref-destino>.supabase.co --port=5432 --username=postgres --dbname=postgres \
    --data-only --no-owner --disable-triggers "/tmp/$t.dump"
done
```

`weather_readings` va al final a propósito — es la más grande (1.38M filas,
probablemente varios cientos de MB) y la que más tiempo toma; si algo falla
antes, mejor que falle temprano con las tablas chicas.

### Paso 4 — verificar conteos

```sql
-- Correr en ambos proyectos y comparar
select 'weather_readings', count(*) from weather_readings
union all select 'clima_lecturas', count(*) from clima_lecturas
union all select 'clima_diario_raw', count(*) from clima_diario_raw
-- ... resto de la tabla de §2
order by 1;
```

### Paso 5 — cron jobs

En el proyecto destino (no se copian con pg_dump salvo que incluyas el
schema `cron`, que normalmente no conviene tocar):

```sql
select cron.schedule('sync-weatherlink-hourly', '5 * * * *',
  $$SELECT public.sync_all_stations()$$);
select cron.schedule('wl-load-historic-runner', '* * * * *',
  $$SELECT process_load_historic_queue()$$);
select cron.schedule('enqueue-incomplete-months-daily', '0 3 * * *',
  $$SELECT public.enqueue_incomplete_months()$$);
select cron.schedule('trueup-sync-counters', '40 4 * * *', $$
    update sync_status ss
    set total_records = c.n
    from (select station_id, count(*) as n from weather_readings group by station_id) c
    where c.station_id = ss.station_id
      and ss.total_records is distinct from c.n
$$);
select cron.schedule('refrescar-lluvia-diaria', '*/15 * * * *',
  $$select public.refrescar_lluvia_diaria_estacion(3); select public.refrescar_resumen_mensual_estacion(); select public.refrescar_prediccion_cache();$$);
```

### Paso 6 — edge functions y secrets

Desplegar las 9 funciones de §6, luego configurar `WEATHERLINK_API_KEY` y
`WEATHERLINK_API_SECRET` en Studio → Edge Functions → Secrets del proyecto
destino.

### Paso 7 — apuntar la app

Actualizar en Vercel (o `.env.local` si se prueba primero en local):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` al proyecto nuevo — pero **solo después de**
verificar el paso 8, para no cortar el pipeline en vivo antes de confirmar
que el nuevo está sano.

---

## 11. Plan de corte (cutover) sin perder lecturas

`weather_readings` recibe escrituras cada hora vía cron. Para no perder la
ventana entre el dump y el corte:

1. Congelar el cron de origen (`select cron.unschedule('sync-weatherlink-hourly')`
   y `wl-load-historic-runner`) justo antes del Paso 3.
2. Correr el Paso 3 (copia de datos).
3. Verificar conteos (Paso 4).
4. Activar los cron del destino (Paso 5) — a partir de acá el destino
   sincroniza solo, en paralelo al origen (que sigue congelado).
5. Confirmar con `select * from sync_status order by last_sync_at desc limit 5;`
   en destino que está recibiendo lecturas frescas de WeatherLink.
6. Recién ahí, Paso 7 (apuntar la app) y, si todo sigue bien 24-48h después,
   dar de baja el proyecto origen (o dejarlo solo de respaldo).

Si el corte se demora más de un rato entre el paso 1 y el paso 3, hay que
correr un segundo `pg_dump --data-only` incremental (`where ts > <último ts
copiado>` para `weather_readings`, o simplemente repetir la tabla completa —
el upsert con `on conflict (station_id, ts)` la hace idempotente).

---

## 12. Verificación post-migración

Adaptado del test de identidad de agricultor que pide `AGENTS.md` para
cualquier vista con `security_invoker`:

```sql
do $$ declare v_uid uuid; begin
  select user_id into v_uid from user_profiles where agricultor_key='<KEY>' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid::text, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
end $$;
select count(*) from public.v_clima_efectivo;   -- debe traer datos, no 0
select count(*) from public.clima_forecast;     -- si migraste user_profiles (§1), debe traer datos
```

Y el health-check estándar del pipeline (§`OPERACION_PIPELINE_CLIMA.md`):

```sql
select * from v_pipeline_health;
```

No usar `service_role` para esta verificación — es exactamente el error que
ya causó el incidente de `v_lote_detalle` (`AGENTS.md`, sección "Nunca cruces
saturno.* en una vista que consuma la app"): con `service_role` todo se ve
bien aunque la RLS esté rota para agricultores reales.
