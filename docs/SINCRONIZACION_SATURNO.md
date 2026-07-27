# Sincronización con Saturno (fuente de la verdad)

Cómo llegan a la app los datos operativos —lotes, agricultores, insumos,
cosecha— y qué hacer cuando algo falla.

---

## 1. De dónde vienen los datos

La fuente de la verdad **no está en el proyecto Supabase de la app**. Vive en el
almacenamiento de **otro proyecto Supabase** (`nwouogywyofnvxsgjttd`), al que se
accede por **protocolo S3**.

| | |
|---|---|
| Endpoint | `https://nwouogywyofnvxsgjttd.storage.supabase.co/storage/v1/s3` |
| Región | `us-east-1` |
| Bucket | `test` |
| Credenciales | cifradas en **Vault**, secreto `saturno_s3` |

Saturno publica un **volcado completo 4 veces al día** (~04:52, 10:52, 16:52 y
22:52 UTC): 53 tablas en JSON, ~71.000 filas, nombradas
`YYYY-MM-DD_N_tabla.json` (N = 0..3).

> **Las credenciales llegaron por WhatsApp en texto plano.** Deben rotarse. Tras
> rotarlas, actualizar el secreto `saturno_s3` en Vault — no hay que tocar código.

---

## 2. Cómo fluyen

```
Bucket S3 (Saturno)
      │  cron `saturno-sync-6h`  ·  20 5,11,17,23 UTC
      ▼
edge function `saturno-sync`
      │  descarga JSON crudo, lo manda por lotes de 500
      ▼
public.saturno_ingerir(tabla, filas)
      │  traduce nombres con saturno.mapa_columnas → upsert por row_id
      ▼
esquema `saturno.*`  (53 tablas espejo, todo TEXT)
      │  public.saturno_promover_lotes()
      ▼
public.lote  (solo el ciclo activo)  →  pantallas de la app
```

### Por qué el espejo es todo TEXT

Es una **capa de ingesta**. Si Saturno escribe `"N/A"` en un campo numérico, un
espejo tipado tumbaría la sincronización entera. Con TEXT nunca falla; la
conversión a fechas y números ocurre al promover a `public.lote`, donde el error
se puede acotar caso por caso.

### Por qué la traducción vive en una tabla y no en el código

`saturno.mapa_columnas` (882 filas) mapea `"Row ID"` → `row_id`,
`"HA_Cosechadas"` → `ha_cosechadas`, etc. La edge function **no conoce el
esquema**: solo descarga y reenvía. Consecuencia útil: **si Saturno agrega una
columna, la carga no se rompe** — el campo se ignora hasta registrarlo en el mapa.

---

## 3. Reglas que no se deben romper

### Las fechas vienen en MM/DD/YYYY (formato estadounidense)

**Verificado**, no asumido: Saturno escribe `04/12/2025` y la app tenía ese mismo
lote como *"sábado, 12 de abril de 2025"*. Leerlo como día/mes correría **cada
cultivo unos ocho meses**, con etapas y recomendaciones equivocadas.

La conversión está centralizada en `public.saturno_fecha(text)`. No parsear
fechas de Saturno en ningún otro sitio.

### Solo se sincroniza el ciclo activo

Los ciclos cerrados quedan **congelados**. Motivo: Saturno ya no conserva las
fechas de siembra reales de 2025 (tiene 0), mientras la app tiene 121. Una
sobrescritura ciega las borraría.

El ciclo activo se detecta por `saturno.ciclo_de_cosecha.activo = 'SI'`, no por
año fijo.

### Los identificadores de lote NO son compatibles

La app usó IDs sintéticos (`L-2026-f0b3ecb346`) y Saturno usa otros
(`L01-P02-742cb71b`); además `codigo_lote` está vacío en el ciclo 2026. **No se
pueden casar registro por registro.** Por eso `saturno_promover_lotes()`
*reconstruye* los lotes del ciclo activo en lugar de actualizarlos.

El vínculo con el agricultor se deriva de `lotes.nombre_productor_v`
(presente en 425/426) → `AgricultorKey`. La cadena vía
`unidades_de_produccion.agropecuaria_id` **no sirve**: solo tiene 24 de 57 lleno.

### Nombres que no casan → `saturno.alias_productor`

Cuando el mismo productor está escrito distinto en cada sistema y ni el nombre
exacto ni la coincidencia por tokens lo resuelven, se agrega una fila a
`saturno.alias_productor`. **Es la vía soportada; no hay que tocar código.**

Casos ya cargados:

| Nombre en Saturno | AgricultorKey | Motivo |
|---|---|---|
| `Wolfgang , Esteger , Bohor` | `WOLFGANGSTEGER` | Saturno escribe el apellido con E |
| `Oscar , Luis , Murillo , Zerpa` | `OSCARMURILLOZERPA` | Perfiles gemelos; su usuario entra con la key corta |

---

## 4. Diagnóstico

**Empezar siempre por aquí:**

```sql
select * from public.v_saturno_salud;
```

Devuelve último volcado ingerido, horas desde la última sincronización, tablas
OK / con error, y cuántos lotes tiene el ciclo activo.

Para ver el detalle por tabla:

```sql
select tabla, filas, ok, error, duracion_ms, created_at
from saturno.sync_log
order by created_at desc limit 60;
```

### Forzar una sincronización

```sql
select public.saturno_disparar_sync();
```

O invocar la función directamente para casos acotados:

```jsonc
// POST /functions/v1/saturno-sync
{ "tablas": ["lotes"], "volcado": "2026-07-27_1", "promover": false }
```

Sin parámetros toma el volcado más reciente. Si ese volcado ya se ingirió
completo (≥50 de 53 tablas OK), **no repite trabajo**.

### Si algo falló

La ingesta es **idempotente** (upsert por `row_id`) y cada tabla se procesa
aislada: un fallo queda registrado y las demás continúan. Una corrida parcial
**se corrige sola en la siguiente**. Rara vez hay que intervenir.

---

## 5. Limitaciones conocidas

- **No hay borrado.** Si Saturno elimina una fila, el espejo la conserva. Los
  lotes sí se reconstruyen por completo en cada promoción, así que ahí no aplica.
- **Solo se promueven lotes.** Las otras 52 tablas quedan disponibles en
  `saturno.*` para consulta, pero todavía no alimentan pantallas. Hay material
  sin explotar: `cosecha`, `lote_cosecha`, `seguimiento`, `plantabilidad`,
  `muestras`, afectación de plagas y malezas, inventario, `tasas_bcv`.
- **Agricultores sin lotes en el origen**: `HECTORDAVIDPEREZGONZALEZ` y
  `MIGUELANGELTOHMELEDEZMA` tienen perfil de 2026 pero Saturno no trae lotes
  suyos. Es un vacío del origen; hay que consultarlo con el equipo de datos.

---

## 6. Objetos creados

| Objeto | Para qué |
|---|---|
| esquema `saturno` | 53 tablas espejo + `sync_log`, `mapa_columnas`, `alias_productor` |
| `saturno_config()` | credenciales S3 desde Vault |
| `saturno_ingerir(tabla, filas)` | ingesta traduciendo nombres |
| `saturno_upsert(tabla, filas)` | upsert de bajo nivel al espejo |
| `saturno_set_mapa(jsonb)` | recarga el mapa de columnas |
| `saturno_fecha(text)` | MM/DD/YYYY → date |
| `saturno_key(text)` / `saturno_tokens(text)` | normaliza nombres de productor |
| `saturno_promover_lotes()` | reconstruye `public.lote` del ciclo activo |
| `saturno_ya_sincronizado(volcado)` | evita reprocesar |
| `saturno_disparar_sync()` | invoca la edge function (lo llama el cron) |
| `v_saturno_salud` | estado de la sincronización |
| edge function `saturno-sync` | orquesta todo |
| cron `saturno-sync-6h` | `20 5,11,17,23 * * *` |

Todas las funciones son `security definer` y están restringidas a
`service_role`; las tablas del espejo tienen RLS **sin políticas**, así que nadie
las lee ni escribe salvo por esta vía.
