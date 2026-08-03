# Operación día a día — pipeline de clima

Documento operativo para administradores. Cubre cómo verificar que el pipeline
de WeatherLink → `weather_readings` → frontend está fluyendo correctamente, y
qué hacer cuando algo no fluye.

> Las queries de este documento se ejecutan desde **Supabase Studio → SQL Editor**
> con la sesión administrativa. No están expuestas al frontend a propósito —
> son metadata operativa, no UX.

Este documento es el **runbook**: qué correr y en qué orden. Para entender *por qué* el
pipeline está diseñado así —la API de WeatherLink, las dos generaciones de sensores, el
rate limiting y los incidentes que motivaron cada decisión— ver
[INTEGRACION_WEATHERLINK.md](INTEGRACION_WEATHERLINK.md).

> **Nota de vigencia:** varias secciones de abajo describen la **triangulación IDW** como
> comportamiento activo. Se retiró el 30-jul-2026 en el `CASE` de `v_clima_efectivo`
> (migración `clima_sin_triangulacion`): hoy quien no tiene estación Davis ve el módulo
> vacío, no una estimación. La RPC `triangulate_clima()` y las coordenadas siguen ahí, así
> que los procedimientos conservan valor si se decide revertir.
> Ver [ARQUITECTURA.md](ARQUITECTURA.md#el-clima-sin-estación-se-muestra-vacío-no-estimado).

---

## Arquitectura en una pantalla

```
WeatherLink API
      │
      ▼ (cron pg_cron cada hora @ :05)
  sync_all_stations()
      │
      ▼ (HTTP POST por estación)
  edge function weatherlink-sync
      │
      ▼
  weather_readings (tabla principal, 299K+ filas)
      │
      ├── sync_status (registro de progreso por estación)
      │
      ▼ (vistas auto-curativas)
  v_estaciones_clima  ◄── lat/lon vienen de unidad_produccion via codigo_up
  v_clima_efectivo    ◄── auto-match agricultor ↔ estación
      │
      ▼
  lib/clima.ts (Next.js server components)
      │
      ▼
  Dashboard / Cultivo / Clima del frontend
```

---

## Queries de health-check

### 1. Snapshot global (la primera que corres siempre)

```sql
select * from v_pipeline_health;
```

Devuelve una sola fila con:

| Columna | Qué significa | Estado sano |
|---|---|---|
| `agricultores_total` | Cuántos agricultores hay en `agropecuaria` | El número que esperas operacionalmente |
| `agricultores_davis` | Conectados a estación Davis directa | Idealmente todos los que tienen estación física |
| `agricultores_triangulated` | Sin estación pero con lat/lon → IDW | Resto con coordenadas |
| `agricultores_sin_datos` | Ni estación ni coordenadas | **Acción**: cargar `codigo_up` o `lat/lon` en `unidad_produccion` |
| `davis_frescos` | Lectura ≤ 24 h | Idealmente = `agricultores_davis` |
| `davis_recientes` | Lectura entre 24 h y 7 días | Tolerable |
| `davis_vencidos` | Lectura entre 7 y 30 días | **Investigar el cron** |
| `davis_congelados` | Lectura > 30 días | **Estación física apagada o desconectada** |
| `match_automatico` | Conectados vía convención `codigo_up = prefijo de station_name` | Mayoría debe ser auto |
| `match_manual_override` | Mapeo explícito en `mapa_productor_clima.station_id` | Solo casos especiales |
| `estaciones_registradas` | Filas en `sync_status` | Debe coincidir con # estaciones físicas |
| `ultimo_dato_global` | Timestamp de la lectura más reciente en cualquier estación | Si > 24 h → cron caído |
| `total_lecturas_db` | Total de filas en `weather_readings` | Sólo informativo |

### 2. Detalle por agricultor (cuando algo se ve mal arriba)

```sql
select * from v_pipeline_health_detalle;
```

Una fila por agricultor con columna `diagnostico` que dice exactamente qué falta:

- `✓ data fluyendo` — todo OK
- `⚠ mapeada pero sin lecturas` — el agricultor tiene estación asignada pero la estación no produce datos (revisar `sync_status`)
- `○ IDW desde estaciones cercanas` — sin estación propia, pero recibe triangulación
- `✗ sin codigo_up en unidad_produccion` — falta cargar la unidad de producción del agricultor
- `✗ sin lat/lon para triangular` — tiene unidad pero sin coordenadas

### 3. Estado del cron WeatherLink

```sql
-- Las últimas 10 corridas del cron horario
select runid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = 1
order by start_time desc
limit 10;

-- Estado por estación según el último intento del cron
select station_id, station_name, status,
       last_sync_at,
       case when last_ts is not null then to_timestamp(last_ts) end as ultima_lectura,
       total_records,
       error_msg
from sync_status
order by status, station_name;
```

### 4. Frescura por estación (rápido)

```sql
select station_name,
       to_timestamp(max(ts)) as ultima_lectura,
       extract(epoch from (now() - to_timestamp(max(ts))))/3600 as horas_atras,
       count(*) as total_filas
from weather_readings
group by station_name
order by max(ts) desc;
```

---

## Acciones operativas comunes

### A. Llega un agricultor nuevo al programa

1. Pedir al equipo agronómico:
   - `codigo_up` (formato: `<estado_letra><número>`, ej: `G08`)
   - lat/lon de la unidad
2. Insertar en `agropecuaria` (AgricultorKey + nombre).
3. Insertar en `unidad_produccion` (codigo_up + lat + lon + estado).
4. Listo. El sistema auto-conecta:
   - Si su `codigo_up` matchea una estación existente → davis directo
   - Si no, pero tiene lat/lon → triangulación IDW
   - Si tampoco → "sin datos" hasta cargar coordenadas

### B. Llega una estación nueva de WeatherLink

1. Verificar que el cron `weatherlink-sync` ya esté escribiendo lecturas a `weather_readings` con `station_id` y `station_name=<codigo_up>-<lugar>`.
2. Insertar en `sync_status` si no está:
   ```sql
   insert into sync_status (station_id, station_name, status)
   values ('<id>', '<nombre_canonico>', 'idle')
   on conflict (station_id) do nothing;
   ```
3. El agricultor cuyo `codigo_up` matchee el prefijo del `station_name` se auto-conecta.

### C. Se rompe una estación física

1. La frescura cae a "vencida" o "congelada" en el detalle.
2. Avisar al equipo de campo.
3. Mientras tanto, el agricultor afectado conserva visión a través de **triangulación IDW** desde estaciones cercanas (siempre que tenga lat/lon en `unidad_produccion`).

### D. Hay que rotar el API key de WeatherLink

1. Generar nueva key en cuenta WeatherLink.
2. Actualizar en Supabase Studio → Settings → Edge Functions → Secrets:
   - `WEATHERLINK_API_KEY`
   - `WEATHERLINK_API_SECRET`
3. Forzar un sync para validar:
   ```sql
   select net.http_post(
     url := 'https://ovcrjupneetifjasecko.supabase.co/functions/v1/weatherlink-sync',
     headers := jsonb_build_object('Content-Type', 'application/json',
                                    'Authorization', 'Bearer <ANON_KEY>'),
     body := jsonb_build_object('station_id', '<una_id>', 'station_name', '<nombre>', 'chunk_days', 1)
   );
   ```

### E. Override manual (estación que no sigue convención de naming)

Solo si el `codigo_up` del agricultor NO matchea el prefijo del `station_name`:

```sql
update mapa_productor_clima
set station_id = '<station_id_objetivo>'
where agricultor_key = '<KEY>';
```

El override prevalece sobre el auto-match.

### F. Herencia entre ciclos (perfiles nuevos sin mapeo)

Cada ciclo crea perfiles nuevos de agropecuaria (key distinta, `codigo_up`
placeholder `AUTO-%`, sin coords), y el mapeo de estación queda huérfano en el
perfil del ciclo anterior. Desde el 22-jul-2026, `v_clima_efectivo` resuelve en
3 niveles: **override → auto_codigo_up → herencia_ciclo**.

La herencia matchea el perfil sin estación contra un perfil hermano CON estación
del mismo productor, por contención de tokens del nombre normalizado (ej:
"Angela Guedez" ⊂ "Angela Rosa Guedez Morales"), con doble unicidad: exactamente
1 donante por huérfano Y 1 huérfano por donante. Homónimos parciales (dos
"Jose Rolando Caldera …") quedan fuera y requieren override manual.

### G. Carga de coordenadas de productores (para triangulación)

Las coordenadas viven en `unidad_produccion.latitud/longitud` y habilitan la
triangulación IDW cuando el agricultor NO tiene estación Davis propia. Carga del
22-jul-2026 (`CoordsProductores.xlsx`, 55 filas / 41 productores): usuarios sin
clima pasaron de 27 a 1.

Trampas encontradas en el archivo de origen — **revisar siempre antes de cargar**:

1. **Longitudes positivas.** Venezuela está siempre en longitud negativa. Dos
   filas venían como `69.22` / `65.74` (faltaba el signo); sin corregir, el
   productor cae al otro lado del planeta.
2. **Coordenadas como texto con coma decimal y símbolo de grado**
   (`"9,1707595°N "`). Un parser ingenuo las descarta en silencio y el productor
   desaparece de la carga sin aviso.
3. **Productores con varias fincas** (hasta 4 filas). Se usa el centroide; si la
   dispersión es grande conviene revisarla (Dennis: 27,7 km de radio).
4. **Nombres cortos vs. nombres largos del sistema** ("Richard Apóstol" vs
   "Richard Jose Apostol Nuñez"). El match es por contención de tokens del
   nombre normalizado, igual que la herencia entre ciclos.
5. **Agricultores sin fila en `unidad_produccion`.** Un `UPDATE` no los alcanza
   porque no hay dónde escribir: hay que **insertar** la UP (placeholder
   `AUTO-NNN`) con las coordenadas.

### H. Contador de lecturas (true-up diario)

`sync_status.total_records` se re-sincroniza cada madrugada desde
`weather_readings` (cron `trueup-sync-counters`, 04:40 UTC). Las vistas ya NO
deciden "¿tiene Davis?" con ese contador — usan `fecha_real` (lecturas reales);
el contador es solo informativo (`davis_dias`).

---

## Glosario

- **codigo_up** — código de unidad de producción, formato `<L><NN>` (ej: `G02`, `P10`, `C01`). `L` = inicial del estado (G=Guárico, P=Portuguesa, C=Cojedes, A=Aragua).
- **station_id** — identificador numérico de la estación en WeatherLink (ej: `186669`).
- **station_name** — nombre canónico en `weather_readings`, formato `<codigo_up>-<lugar>` (ej: `G02-Los Espinitos`).
- **fuente** — `davis` (lectura directa) | `triangulated` (IDW de cercanas) | `sin_datos`.
- **match_type** — `auto_codigo_up` (vía convención) | `override` (asignación manual) | `herencia_ciclo` (heredado del perfil hermano de otro ciclo).

---

## Decisión de diseño: por qué auto-curativo y no estático

Antes la conexión agricultor↔estación vivía en `mapa_productor_clima` como filas pre-cargadas. Si se agregaba un agricultor o una estación, no había nada que actualizara la tabla → quedaba desconectado hasta intervención humana.

Decisión del 5-may-2026: derivar la conexión en tiempo de query usando la convención de naming `codigo_up = prefijo de station_name`. Beneficio: cero mantenimiento manual cuando el equipo agronómico carga datos nuevos. La tabla `mapa_productor_clima.station_id` queda solo para overrides excepcionales.

---

## Hardening de seguridad (11-jun-2026)

Aplicado vía 3 migraciones (`hardening_rls_tablas_expuestas`, `hardening_search_path_funciones`,
`hardening_vistas_security_invoker`):

1. **Escrituras anónimas cerradas.** `chirps_lluvia`, `modis_ndvi`, `faostat_benchmarks` y
   `usda_psd` tenían INSERT/UPDATE abiertos a `anon` (riesgo de envenenar el predictor).
   Eliminadas. Cargas futuras de esos datasets: usar **service_role** (bypassa RLS).
2. **RLS habilitado** en `mapa_productor_clima`, `productor_coordenadas`, `clima_diario_raw`,
   `clima_percentiles_enso` (lectura pública, escritura solo service_role) y
   `load_historic_queue` (sin políticas: solo service_role/cron).
   ⚠️ Consecuencia operativa: los **overrides de estación** ahora se cargan con service_role
   (SQL editor del dashboard o el cargador de `docs/imports/2026/`), ya no con la anon key.
3. **`sync_all_stations()` revocada** para `anon`/`authenticated` — solo el cron (postgres)
   puede dispararla. Evita tormentas de sync que quemen el rate limit de WeatherLink.
4. **21 vistas pasadas a `security_invoker`** — antes saltaban el RLS del consultante
   (un farmer podía leer lotes/UP de otros vía `v_compat_*`). Verificado post-cambio:
   anon (edge functions) ve todo lo necesario, farmer ve solo lo suyo, master ve todo.
5. **`search_path` fijado** en las 16 funciones propias (mitiga hijacking en SECURITY DEFINER).
6. **Next.js 16.2.4 → 16.2.9** (13 advisories) y `ws` parcheado.

Pendiente manual (dashboard Supabase): **Auth → Passwords → Leaked password protection: ON**.
Pendiente antes de rollout real: rotar la contraseña uniforme de los usuarios farmer de prueba.
Deuda aceptada: `xlsx` (2 high sin fix; solo procesa data propia server-side — migrar a exceljs).
