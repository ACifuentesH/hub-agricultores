# Carga de data — ciclo 2026

Origen: Excel del programa Polar agricultura por contrato, ciclo 2026.
Procesado por LLM externo y entregado el 5-may-2026.

## Estado de carga

| Tabla | Granularidad | Estado | Nota |
|---|---|---|---|
| TABLA 1 — lote_cosecha | por lote | **bloqueada** | falta columna `agricultor_ref` para desambiguar 19 duplicados |
| TABLA 2 — lote_suelo | por lote | **bloqueada** | mismo motivo |
| TABLA 3 — producto_registro | por lote | **bloqueada** | mismo motivo |
| TABLA 4 — unidad_produccion_finanzas | por agricultor | cargada | `codigo_up` placeholder `AUTO-NNN` hasta que llegue mapeo real |
| TABLA 5 — rendimiento_agricultor | por agricultor | cargada | rendimiento es ESTIMADO, no real cosechado |

## Decisiones aplicadas (5-may-2026)

1. Cohorte 2026 NO reemplaza la del 2025 — coexisten vía columna `ciclo`
2. Rendimiento estimado se mapea a `valor_meta_rend_ha`, no a `rendimiento_real`
3. No hay data de cosecha real cargada — pendiente de futura recopilación
4. Lotes con `ha_sembradas = 0` (62 filas) se descartan
5. `codigo_up` real lo provee equipo agronómico después; mientras tanto placeholder

## Migraciones aplicadas
Ver Supabase migrations de la fecha 2026-05-05:
- `agregar_columna_ciclo_a_tablas_principales`
- `insertar_agricultores_ciclo_2026`
- `insertar_unidades_y_finanzas_ciclo_2026`
- `insertar_rendimiento_agricultor_ciclo_2026`

---

## Mapeo clima/predicción 2026 (cuando agronomía entregue estaciones + coords)

Resuelve el pendiente #5: encender clima y predicción para los agricultores 2026
que hoy salen como "sin datos" (codigo_up placeholder `AUTO-NNN`).

**Por qué override y no `codigo_up` real:** `codigo_up` es PRIMARY KEY de
`unidad_produccion` y los códigos de estación (G05, P04…) ya los usa el ciclo
2025. Por eso el perfil 2026 comparte la estación vía la tabla de override
`mapa_productor_clima`. Mismo patrón que se aplicó manualmente a Francisco
González y Oscar Murillo el 2026-06-05.

**Coordenadas automáticas (desde 2026-06-05):** la predicción toma lat/lon de la
estación asignada (tabla `estaciones_davis`, 44 estaciones con coords reales). Por
eso, para un agricultor con estación **basta asignarle el override** — clima y
predicción encienden juntos. **Solo los satelitales** (sin estación) necesitan
lat/lon manual en su UP.

### Archivos
| Archivo | Uso |
|---|---|
| `PLANTILLA_mapeo_clima_2026.csv` | 31 agricultores pendientes pre-cargados. Agronomía rellena `codigo_estacion` (y opcional `station_id`). `latitud`/`longitud` **solo para satelitales**. |
| `CATALOGO_estaciones.csv` | Las **44** estaciones del catálogo `estaciones_davis` (código, nombre, id, región, coords, frescura, finca cercana). Fuente de los códigos. |
| `cargar_mapeo_clima_2026.sql` | Cargador idempotente: dry-run → aplicar → verificar → rollback. |

### Pasos
1. Agronomía llena la **plantilla** (una fila por agricultor; `codigo_estacion`
   tomado del **catálogo**). Con estación, lat/lon es **opcional**. Si un
   agricultor no tiene Davis (solo satélite), deja `codigo_estacion`/`station_id`
   vacíos y llena `latitud`/`longitud`.
2. Pega las filas en el bloque `VALUES` del **PASO 0** del `.sql` y córrelo:
   valida sin escribir. Todo debe decir `key_existe=true`,
   `estado_estacion ∈ {ok, solo_coords}` y `estado_predic ∈ {predic auto desde
   estación, coords manuales -> UP}`.
3. Corrige `ESTACION_NO_ENCONTRADA` / `FALTAN coords` / `SIN_UP`, pega las mismas
   filas en el **PASO 1** y ejecútalo (escribe override + coords si las hay).
4. **PASO 2** verifica clima + predicción por agricultor. Live al instante.

### Catálogo de estaciones (2026-06-05)
- Se cargaron **44 estaciones** en la tabla `estaciones_davis` y se sumaron al
  pipeline **16 nuevas** (B01; G09–G13; P15–P19; Y02/Y03/Y05/Y06/Y07). Todas
  sincronizan y están frescas; las 16 nuevas con ~10 días de histórico (se puede
  hacer backfill profundo aparte si el predictor lo requiere).
- La columna `finca_cercana` del catálogo es referencia del instalador/contacto,
  **no** del dueño del lote — no usarla como mapeo agricultor→estación directo.

### Casos especiales detectados (2026-06-05)
- **Sin `unidad_produccion`:** Hector Perez, Miguel Tohme, Marco Fantinel — hay
  agropecuaria pero no UP. **Con estación**, clima y predicción (coords de la
  estación) encienden igual sin UP. El UP solo hace falta si son **satelitales**
  (para guardar sus coords) — en ese caso **crear el UP** primero.
- **`codigo_up` real sin estación sincronizada:** Antonio Fabio Ceccarello tiene
  `codigo_up=P13`, pero no existe estación `P13-*` → asignarle por override una
  estación cercana del catálogo (hoy hay 44 para elegir).

### Rollback
Bloque ROLLBACK al final del `.sql` (borra el override y limpia coords por key).
