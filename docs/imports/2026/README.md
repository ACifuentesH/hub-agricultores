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
