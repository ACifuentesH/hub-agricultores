import fs from 'node:fs'
import path from 'node:path'
import { parseCsv } from './csv'
import { DEMO_USER_ID } from './constants'

/**
 * Carga perezosa y en memoria de todos los CSVs de /demo-data. Server-only
 * (usa `fs`) — nunca importar desde un componente 'use client'.
 *
 * Los arrays que devuelve `getTable` son la MISMA referencia guardada acá:
 * insert/update/delete (ver engine.ts) los mutan directamente, así que los
 * cambios hechos en modo demo persisten mientras el proceso de `next dev`
 * siga corriendo, y se pierden al reiniciarlo — coherente con "no hay
 * conexión viva", no hace falta más que eso para un demo.
 */

const DEMO_DIR = path.join(process.cwd(), 'demo-data')

// Nombre de tabla/vista (tal como lo usa el código) → archivo en /demo-data.
const TABLE_FILES: Record<string, string> = {
  // Módulo de lluvia/predicción (CSVs originales del usuario)
  agricultores: 'agricultores.csv',
  lotes_seguimiento_lluvia: 'lotes_seguimiento_lluvia.csv',
  estaciones_coordenadas: 'estaciones_coordenadas.csv',
  estaciones_zona: 'estaciones_zona.csv',
  config_prediccion: 'config_prediccion.csv',
  vista_seguimiento_lluvia: 'vista_seguimiento_lluvia.csv',
  vista_lote_coordenadas: 'vista_lote_coordenadas.csv',
  vista_lluvia_diaria_lote: 'vista_lluvia_diaria_lote.csv',
  vista_lluvia_mensual_lote: 'vista_lluvia_mensual_lote.csv',
  vista_lluvia_mensual_zona: 'vista_lluvia_mensual_zona.csv',
  vista_prediccion_lluvia_lote: 'vista_prediccion_lluvia_lote.csv',
  vista_prediccion_lluvia_zona: 'vista_prediccion_lluvia_zona.csv',
  vista_distribucion_normal_lluvia: 'vista_distribucion_normal_lluvia.csv',
  vista_lluvia_diaria_estacion: 'vista_lluvia_diaria_estacion.csv',

  // Resto de la app (exportados directo de Supabase vía MCP, ver AGENTS
  // internos — el proyecto está ACTIVE_HEALTHY, solo el REST público con
  // anon key devuelve 402 por facturación)
  user_profiles: 'user_profiles.csv',
  lote: 'lote.csv',
  lote_analisis_suelo: 'lote_analisis_suelo.csv',
  lote_eventos: 'lote_eventos.csv',
  producto_registro: 'producto_registro.csv',
  tickets: 'tickets.csv',
  v_lote_detalle: 'v_lote_detalle.csv',
  v_agricultor_resumen: 'v_agricultor_resumen.csv',
  pl_unidad: 'pl_unidad.csv',
  v_productores_predictor: 'v_productores_predictor.csv',
  v_clima_efectivo: 'v_clima_efectivo.csv',
  mapa_productor_clima: 'mapa_productor_clima.csv',
  clima_forecast: 'clima_forecast.csv',
  agricultor_lluvia_map: 'agricultor_lluvia_map.csv',
  agropecuaria: 'agropecuaria.csv',
  // Agregado DIARIO por estación (no lectura cruda cada 15 min: la tabla real
  // tiene 1.38M filas). Mismas columnas que la tabla real (fecha_hora, ts,
  // temp_c, hum_pct, lluvia_mm, ...) así que encaja sin cambios en el código
  // que la consulta — sólo con menos resolución temporal (1 fila/día/estación
  // en vez de cada ~15 min). "Condiciones actuales" y el excel histórico
  // quedan con precisión de "promedio del día" en vez de instantánea.
  weather_readings: 'weather_readings.csv',
}

let cache: Map<string, Record<string, unknown>[]> | null = null

function loadAll(): Map<string, Record<string, unknown>[]> {
  if (cache) return cache
  const store = new Map<string, Record<string, unknown>[]>()
  for (const [table, file] of Object.entries(TABLE_FILES)) {
    const fp = path.join(DEMO_DIR, file)
    if (!fs.existsSync(fp)) {
      console.warn(`[demo-mode] falta /demo-data/${file} — "${table}" queda vacía`)
      store.set(table, [])
      continue
    }
    try {
      store.set(table, parseCsv(fs.readFileSync(fp, 'utf-8')))
    } catch (e) {
      console.error(`[demo-mode] error parseando ${file}:`, e)
      store.set(table, [])
    }
  }
  ensureDemoUserProfile(store)
  cache = store
  return store
}

/**
 * El usuario demo necesita una fila propia en user_profiles (rol master, sin
 * agricultor_key fijo) para que layout.tsx / lib/auth.ts / middleware.ts lo
 * resuelvan igual que a cualquier perfil real, sin lógica especial en cada
 * consumidor.
 */
function ensureDemoUserProfile(store: Map<string, Record<string, unknown>[]>) {
  const profiles = store.get('user_profiles') ?? []
  if (!profiles.some(p => p.user_id === DEMO_USER_ID)) {
    profiles.push({ user_id: DEMO_USER_ID, agricultor_key: null, role: 'master' })
  }
  store.set('user_profiles', profiles)
}

/** Devuelve el array VIVO (mutable) de una tabla/vista. Nunca falla: tablas sin CSV quedan vacías. */
export function getTable(name: string): Record<string, unknown>[] {
  const store = loadAll()
  if (!store.has(name)) {
    console.warn(`[demo-mode] tabla/vista "${name}" no está en TABLE_FILES — devolviendo vacío`)
    store.set(name, [])
  }
  return store.get(name)!
}
