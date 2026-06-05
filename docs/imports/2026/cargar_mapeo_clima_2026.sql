-- ============================================================================
-- CARGADOR EN LOTE — Mapeo clima/predicción ciclo 2026
-- ----------------------------------------------------------------------------
-- Para cada agricultor pendiente, hace DOS cosas (igual que el arreglo manual
-- de Francisco/Oscar):
--   1) OVERRIDE de estación en mapa_productor_clima   -> enciende el MÓDULO CLIMA
--   2) COORDENADAS en su unidad_produccion (UP)        -> enciende la PREDICCIÓN
--
-- Es IDEMPOTENTE: puedes correrlo varias veces; re-aplica sin duplicar.
-- No toca el frontend ni el edge function. Cambios en vivo al instante
-- (las páginas son force-dynamic).
--
-- FLUJO:
--   PASO 0 (dry-run)  -> valida sin escribir. Revisa que todo diga true.
--   PASO 1 (aplicar)  -> escribe override + coords.
--   PASO 2 (verificar)-> confirma clima + predicción por agricultor.
--   ROLLBACK          -> revierte si hace falta.
--
-- CÓMO LLENAR: pega las filas de PLANTILLA_mapeo_clima_2026.csv (ya rellenada
-- por agronomía) dentro del bloque VALUES, en CADA paso que lo tenga.
-- Formato de cada fila:
--   ('AGRICULTOR_KEY', 'CODIGO_ESTACION', 'STATION_ID_OPCIONAL', LAT, LON)
--   - CODIGO_ESTACION: ej. 'G05'. Si el agricultor NO tiene estación Davis
--     (solo satélite), déjalo NULL -> solo se cargan coords (predicción satelital).
--   - STATION_ID_OPCIONAL: pégalo del CATALOGO si quieres máxima precisión;
--     si lo dejas NULL se resuelve por CODIGO_ESTACION.
--   - LAT/LON: en grados decimales. Si NULL, no se tocan las coords.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PASO 0 — DRY RUN (no escribe nada). Corre esto PRIMERO.                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
WITH mapping(agricultor_key, codigo_estacion, station_id, lat, lon) AS (
  VALUES
    -- ▼▼▼ PEGA AQUÍ LAS FILAS ▼▼▼  (ejemplo, borra y reemplaza)
    ('JOSEDARIOGALLUCCIREQUENA', 'P13', NULL, 9.12345, -69.12345)
    -- ,('OTROKEY', 'G07', NULL, 9.0, -66.0)
    -- ▲▲▲ FIN DE FILAS ▲▲▲
)
SELECT
  m.agricultor_key,
  (a."AgricultorKey" IS NOT NULL)                              AS key_existe,
  CASE WHEN m.codigo_estacion IS NULL AND m.station_id IS NULL THEN 'solo_coords'
       WHEN st.station_id IS NOT NULL THEN 'ok'
       ELSE 'ESTACION_NO_ENCONTRADA' END                       AS estado_estacion,
  st.station_id                                                AS station_id_resuelto,
  st.station_name                                              AS estacion_resuelta,
  CASE WHEN up.codigo_up IS NULL THEN 'SIN_UP (crear UP primero)'
       WHEN m.lat IS NULL OR m.lon IS NULL THEN 'sin_coords_en_fila'
       ELSE 'ok' END                                           AS estado_coords,
  up.codigo_up                                                 AS up_destino
FROM mapping m
LEFT JOIN agropecuaria a            ON a."AgricultorKey" = m.agricultor_key
LEFT JOIN unidad_produccion up      ON up.agropecuaria_id = a.agropecuaria_id
LEFT JOIN LATERAL (
  SELECT ss.station_id, ss.station_name
  FROM sync_status ss
  WHERE (m.station_id IS NOT NULL AND ss.station_id = m.station_id)
     OR (m.codigo_estacion IS NOT NULL
         AND upper(trim(split_part(ss.station_name, '-', 1))) = upper(trim(m.codigo_estacion)))
  LIMIT 1
) st ON true;
-- Revisa: key_existe=true, estado_estacion ∈ {ok, solo_coords}, estado_coords ∈ {ok, ...}.
-- Si ves ESTACION_NO_ENCONTRADA o SIN_UP, corrige esa fila antes del PASO 1.


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PASO 1 — APLICAR. Pega las MISMAS filas en el VALUES de abajo.            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
WITH mapping(agricultor_key, codigo_estacion, station_id, lat, lon) AS (
  VALUES
    -- ▼▼▼ PEGA AQUÍ LAS MISMAS FILAS ▼▼▼
    ('JOSEDARIOGALLUCCIREQUENA', 'P13', NULL, 9.12345, -69.12345)
    -- ▲▲▲ FIN DE FILAS ▲▲▲
),
resuelto AS (
  SELECT m.agricultor_key, m.lat, m.lon,
         a.nombre_agropecuaria, a.agropecuaria_id, up.codigo_up,
         COALESCE(
           m.station_id,
           (SELECT ss.station_id FROM sync_status ss
             WHERE m.codigo_estacion IS NOT NULL
               AND upper(trim(split_part(ss.station_name, '-', 1))) = upper(trim(m.codigo_estacion))
             LIMIT 1)
         ) AS station_id_final
  FROM mapping m
  JOIN agropecuaria a                ON a."AgricultorKey" = m.agricultor_key
  LEFT JOIN unidad_produccion up     ON up.agropecuaria_id = a.agropecuaria_id
),
ovr AS (  -- (1) override de estación -> CLIMA
  INSERT INTO mapa_productor_clima (productor_clima, agricultor_key, agricultor_nombre, station_id)
  SELECT nombre_agropecuaria || ' (2026)', agricultor_key, nombre_agropecuaria, station_id_final
  FROM resuelto
  WHERE station_id_final IS NOT NULL
  ON CONFLICT (agricultor_key) DO UPDATE SET station_id = EXCLUDED.station_id
  RETURNING agricultor_key
),
crd AS (  -- (2) coordenadas en el UP -> PREDICCIÓN
  UPDATE unidad_produccion u
  SET latitud = r.lat, longitud = r.lon
  FROM resuelto r
  WHERE u.codigo_up = r.codigo_up
    AND r.lat IS NOT NULL AND r.lon IS NOT NULL
  RETURNING u.codigo_up
)
SELECT (SELECT count(*) FROM ovr) AS overrides_aplicados,
       (SELECT count(*) FROM crd) AS coords_aplicadas;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PASO 2 — VERIFICAR. Lista keys cargadas entre comillas.                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
SELECT ce.agricultor_key, ce.nombre_agropecuaria,
       ce.fuente AS clima_fuente, ce.davis_key AS estacion, ce.match_type,
       to_char(ce.fecha_real, 'YYYY-MM-DD HH24:MI') AS clima_ultima_lectura,
       pp.modo_datos AS pred_modo,
       (pp.lat IS NOT NULL) AS predic_renderiza
FROM v_clima_efectivo ce
JOIN v_productores_predictor pp ON pp.agricultor_key = ce.agricultor_key
WHERE ce.agricultor_key IN (
  'JOSEDARIOGALLUCCIREQUENA'   -- ,'OTROKEY'...
)
ORDER BY ce.nombre_agropecuaria;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ROLLBACK (opcional) — revierte lo cargado para las keys indicadas.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- BEGIN;
-- DELETE FROM mapa_productor_clima WHERE agricultor_key IN ('JOSEDARIOGALLUCCIREQUENA');
-- UPDATE unidad_produccion u SET latitud = NULL, longitud = NULL
--   FROM agropecuaria a
--   WHERE u.agropecuaria_id = a.agropecuaria_id
--     AND a."AgricultorKey" IN ('JOSEDARIOGALLUCCIREQUENA');
-- COMMIT;
