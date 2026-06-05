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
`mapa_productor_clima` (clima) + coordenadas en su UP (predicción). Mismo patrón
que se aplicó manualmente a Francisco González y Oscar Murillo el 2026-06-05.

### Archivos
| Archivo | Uso |
|---|---|
| `PLANTILLA_mapeo_clima_2026.csv` | 31 agricultores pendientes pre-cargados. Agronomía rellena `codigo_estacion`, `latitud`, `longitud` (y opcional `station_id`). |
| `CATALOGO_estaciones.csv` | Las 28 estaciones válidas (código, nombre, id, frescura). Fuente de los códigos. |
| `cargar_mapeo_clima_2026.sql` | Cargador idempotente: dry-run → aplicar → verificar → rollback. |

### Pasos
1. Agronomía llena la **plantilla** (una fila por agricultor; `codigo_estacion`
   tomado del **catálogo**). Si un agricultor no tiene Davis (solo satélite),
   deja `codigo_estacion`/`station_id` vacíos y llena solo lat/lon.
2. Pega las filas llenadas en el bloque `VALUES` del **PASO 0** del `.sql` y
   córrelo: valida sin escribir. Todo debe decir `key_existe=true`,
   `estado_estacion ∈ {ok, solo_coords}`, `estado_coords ∈ {ok, ...}`.
3. Corrige cualquier `ESTACION_NO_ENCONTRADA` o `SIN_UP`, pega las mismas filas
   en el **PASO 1** y ejecútalo (escribe override + coords).
4. **PASO 2** verifica clima + predicción por agricultor. Live al instante.

### Casos especiales detectados (2026-06-05)
- **Sin `unidad_produccion`:** Hector Perez, Miguel Tohme, Marco Fantinel — hay
  agropecuaria pero no UP. Hay que **crear el UP** antes de cargar coords (el
  override de estación sí funciona sin UP, pero la predicción necesita el UP).
- **`codigo_up` real sin estación sincronizada:** Antonio Fabio Ceccarello tiene
  `codigo_up=P13`, pero no existe estación `P13-*` en `sync_status` → asignar una
  estación existente del catálogo vía override, o sincronizar P13 primero.

### Rollback
Bloque ROLLBACK al final del `.sql` (borra el override y limpia coords por key).
