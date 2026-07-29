#!/usr/bin/env node
/**
 * Carga masiva del backlog local de análisis de suelo (PDFs) al módulo
 * Documentación (`lote_analisis_suelo` + bucket privado `analisis-suelo`).
 *
 * El backlog vive fuera del repo, en la máquina de quien lo corre, con
 * estructura fija de dos niveles: `Zona/NombreAgricultor/archivo.pdf`
 * (p. ej. `1Occidente/Ezequiel Fontiveros/....pdf`). Los nombres de archivo
 * reales son ruidosos (traen zona, cultivo, apellidos, etc.), así que en vez
 * de confiar únicamente en `match_archivo_a_agricultor(filename)` contra el
 * nombre de archivo completo (que diluye la similitud), este script también
 * la llama contra el nombre de la carpeta del agricultor —la señal limpia—
 * y usa el acuerdo entre ambas como corroboración.
 *
 * Dos fases, dry-run por defecto:
 *   1) Dry-run (sin --commit): camina la carpeta, matchea, chequea
 *      duplicados contra lo ya cargado, y escribe un CSV para revisión
 *      humana. NO toca Supabase (ni storage ni tabla).
 *   2) Commit (--commit --report=<csv ya revisado>): relee ese CSV (que la
 *      persona pudo haber corregido a mano) y sólo sube las filas
 *      aprobadas.
 *
 * Uso:
 *   node --env-file=.env.local scripts/bulk-import-analisis-suelo.mjs \
 *     --folder="C:\ruta\al\backlog" --ciclo=2026
 *
 *   node --env-file=.env.local scripts/bulk-import-analisis-suelo.mjs \
 *     --folder="C:\ruta\al\backlog" --ciclo=2026 \
 *     --commit --report=scripts/bulk-import-report.csv
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el
 * entorno (por eso `--env-file=.env.local`) — igual que
 * `app/api/documentos/upload/route.ts`, nunca la anon key para escribir.
 */

import { createClient } from '@supabase/supabase-js'
import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = {}
  for (const raw of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(raw)
    if (!m) continue
    const [, key, val] = m
    args[key] = val === undefined ? true : val
  }
  return args
}

function usage() {
  return `
Uso:
  node --env-file=.env.local scripts/bulk-import-analisis-suelo.mjs --folder="<ruta>" --ciclo=2026 [--commit --report=scripts/bulk-import-report.csv]

Argumentos:
  --folder=<ruta>  Carpeta raíz del backlog local (Zona/Agricultor/archivo.pdf). Obligatorio, sin default.
  --ciclo=<AAAA>   Ciclo agrícola de 4 dígitos. Obligatorio: nunca se infiere (ver AGENTS.md).
  --commit         Si se omite, corre en modo dry-run (no escribe nada en Supabase). Es el modo seguro por defecto.
  --report=<ruta>  CSV de reporte. Dry-run: se ESCRIBE ahí. Commit: se RELEE de ahí (default: scripts/bulk-import-report.csv).
`
}

// ---------------------------------------------------------------------------
// Walk: estructura fija Zona/Agricultor/archivo.pdf (no un scanner recursivo)
// ---------------------------------------------------------------------------

/**
 * Camina `folder/Zona/Agricultor/*.pdf`. Cualquier cosa que no encaje en esa
 * forma exacta (un archivo suelto a nivel de zona, una carpeta a nivel de
 * "archivo", un PDF a tres niveles de profundidad, un `.doc` legacy, etc.) se
 * reporta como warning y se salta — nunca se recorre "a ciegas" ni se
 * revienta el script.
 */
export async function walkBacklog(rootFolder) {
  const archivos = []
  const warnings = []

  let zonaEntries
  try {
    zonaEntries = await readdir(rootFolder, { withFileTypes: true })
  } catch (err) {
    throw new Error(`No se pudo leer la carpeta raíz "${rootFolder}": ${err.message}`)
  }

  for (const zonaEntry of zonaEntries) {
    const zonaPath = path.join(rootFolder, zonaEntry.name)
    if (!zonaEntry.isDirectory()) {
      // p. ej. el Análisis.xlsx suelto en la raíz del backlog.
      warnings.push(`Ignorado (esperaba carpeta de zona, encontré archivo): ${zonaPath}`)
      continue
    }
    const zona = zonaEntry.name

    let agricultorEntries
    try {
      agricultorEntries = await readdir(zonaPath, { withFileTypes: true })
    } catch (err) {
      warnings.push(`No se pudo leer la zona "${zonaPath}": ${err.message}`)
      continue
    }

    let carpetasConPdf = 0
    for (const agriEntry of agricultorEntries) {
      const agriPath = path.join(zonaPath, agriEntry.name)
      if (!agriEntry.isDirectory()) {
        warnings.push(`Ignorado (esperaba carpeta de agricultor, encontré archivo): ${agriPath}`)
        continue
      }
      const carpetaAgricultor = agriEntry.name

      let archivoEntries
      try {
        archivoEntries = await readdir(agriPath, { withFileTypes: true })
      } catch (err) {
        warnings.push(`No se pudo leer la carpeta de agricultor "${agriPath}": ${err.message}`)
        continue
      }

      let pdfsEnEstaCarpeta = 0
      for (const archivoEntry of archivoEntries) {
        const archivoPath = path.join(agriPath, archivoEntry.name)
        if (!archivoEntry.isFile()) {
          warnings.push(`Ignorado (tercera capa de carpetas inesperada): ${archivoPath}`)
          continue
        }
        if (!/\.pdf$/i.test(archivoEntry.name)) {
          // .doc legacy u otra cosa: se salta en silencio, no es un error.
          continue
        }
        archivos.push({
          zona,
          carpetaAgricultor,
          archivo: archivoEntry.name,
          rutaAbsoluta: path.resolve(archivoPath),
        })
        pdfsEnEstaCarpeta++
      }
      if (pdfsEnEstaCarpeta > 0) carpetasConPdf++
    }

    if (carpetasConPdf === 0) {
      // Caso esperado para zonas como 11UCV / 2Oriente: sólo .doc legacy.
      // Se reporta y se sigue — 0 procesados, no es un error.
      console.log(`  (0 PDFs) zona "${zona}": ninguna carpeta de agricultor con PDFs.`)
    }
  }

  return { archivos, warnings }
}

// ---------------------------------------------------------------------------
// Matching: función pura, testeable con resultados de RPC simulados
// ---------------------------------------------------------------------------

// El umbral mínimo (0.15) ya lo aplica la propia RPC — acá solo hace falta
// el corte para AUTO_OK.
const SCORE_AUTO = 0.5

/**
 * Clasifica un archivo a partir de los resultados YA EJECUTADOS de las dos
 * llamadas a `match_archivo_a_agricultor`: una contra el nombre de carpeta
 * del agricultor (señal limpia, se usa como sugerencia primaria) y otra
 * contra el nombre de archivo completo (ruidoso, sirve de corroboración).
 *
 * Pura a propósito: no llama a Supabase, así que se puede testear con
 * arrays simulados (mock de lo que devolvería la RPC).
 *
 * @param matchesCarpeta filas de la RPC (ordenadas por similitud desc) para el nombre de carpeta
 * @param matchesArchivo filas de la RPC para el nombre de archivo completo
 */
export function clasificarMatch(matchesCarpeta, matchesArchivo) {
  const topCarpeta = matchesCarpeta?.[0] ?? null
  const topArchivo = matchesArchivo?.[0] ?? null

  const confCarpeta = topCarpeta?.similitud ?? 0
  const confArchivo = topArchivo?.similitud ?? 0

  if (!topCarpeta && !topArchivo) {
    return {
      decision: 'SIN_MATCH',
      agricultor_key: '',
      nombre_sugerido: '',
      confianza_carpeta: 0,
      confianza_archivo: 0,
    }
  }

  const acuerdo = !!topCarpeta && !!topArchivo && topCarpeta.agricultor_key === topArchivo.agricultor_key

  // Sugerencia primaria: el match de carpeta (señal limpia). Si no hubo
  // ninguno por encima del umbral, se cae al de archivo.
  const primario = topCarpeta ?? topArchivo

  let decision
  if (topCarpeta && confCarpeta > SCORE_AUTO && acuerdo) {
    decision = 'AUTO_OK'
  } else {
    // Hay algún match (>= SCORE_MIN por construcción de la RPC) pero
    // discrepan, o las confianzas son sólo medianas.
    decision = 'REVISAR'
  }

  return {
    decision,
    agricultor_key: primario.agricultor_key,
    nombre_sugerido: primario.nombre_agropecuaria,
    confianza_carpeta: Number(confCarpeta.toFixed(4)),
    confianza_archivo: Number(confArchivo.toFixed(4)),
  }
}

// ---------------------------------------------------------------------------
// Duplicate guard: función pura
// ---------------------------------------------------------------------------

/** Normaliza un nombre de archivo para comparación laxa (sin acentos, sin separadores, sin extensión). */
export function normalizarNombreArchivo(nombre) {
  return String(nombre)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * ¿Ya existe en `existentes` (filas de `lote_analisis_suelo` ya filtradas
 * por agricultor_key + ciclo + categoria='analisis_suelo') un archivo que
 * corresponda a `archivo`? Compara exacto y también normalizado/laxo.
 */
export function esDuplicado(existentes, archivo) {
  if (existentes.some((e) => e.nombre_archivo === archivo)) return true
  const norm = normalizarNombreArchivo(archivo)
  return existentes.some((e) => normalizarNombreArchivo(e.nombre_archivo ?? '') === norm)
}

// ---------------------------------------------------------------------------
// CSV: lectura/escritura mínimas (RFC4180), sin dependencias nuevas
// ---------------------------------------------------------------------------

const REPORT_COLUMNS = [
  'zona',
  'carpeta_agricultor',
  'archivo',
  'ruta_absoluta',
  'agricultor_key_sugerido',
  'nombre_sugerido',
  'confianza_carpeta',
  'confianza_archivo',
  'decision',
]

const RESULT_COLUMNS = [...REPORT_COLUMNS, 'resultado', 'mensaje']

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function filasACsv(filas, columnas) {
  const lineas = [columnas.join(',')]
  for (const fila of filas) {
    lineas.push(columnas.map((c) => csvEscape(fila[c])).join(','))
  }
  return lineas.join('\r\n') + '\r\n'
}

/** Parser CSV mínimo: soporta campos entre comillas con comas/saltos de línea/comillas escapadas. */
export function csvAFilas(texto) {
  const filasCrudas = []
  let fila = []
  let campo = ''
  let enComillas = false
  let i = 0
  const n = texto.length

  while (i < n) {
    const c = texto[i]
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i += 2
          continue
        }
        enComillas = false
        i++
        continue
      }
      campo += c
      i++
      continue
    }
    if (c === '"') {
      enComillas = true
      i++
      continue
    }
    if (c === ',') {
      fila.push(campo)
      campo = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      fila.push(campo)
      filasCrudas.push(fila)
      fila = []
      campo = ''
      i++
      continue
    }
    campo += c
    i++
  }
  if (campo.length > 0 || fila.length > 0) {
    fila.push(campo)
    filasCrudas.push(fila)
  }

  if (filasCrudas.length === 0) return []
  const headers = filasCrudas[0]
  return filasCrudas
    .slice(1)
    .filter((f) => !(f.length === 1 && f[0] === '')) // línea vacía final
    .map((f) => Object.fromEntries(headers.map((h, idx) => [h, f[idx] ?? ''])))
}

// ---------------------------------------------------------------------------
// Supabase: RPC de matching y helper de resumen
// ---------------------------------------------------------------------------

async function matchArchivoAAgricultor(supabase, filename) {
  const { data, error } = await supabase.rpc('match_archivo_a_agricultor', { filename })
  if (error) {
    console.error(`    ! Error en RPC match_archivo_a_agricultor("${filename}"): ${error.message}`)
    return []
  }
  return data ?? []
}

function imprimirResumen(filas) {
  const conteo = {}
  for (const f of filas) conteo[f.decision] = (conteo[f.decision] ?? 0) + 1
  console.log('\nResumen:')
  const claves = ['AUTO_OK', 'REVISAR', 'SIN_MATCH', 'SKIP_DUPLICADO']
  for (const clave of claves) console.log(`  ${clave}: ${conteo[clave] ?? 0}`)
  for (const otra of Object.keys(conteo)) {
    if (!claves.includes(otra)) console.log(`  ${otra}: ${conteo[otra]}`)
  }
  console.log(`  TOTAL: ${filas.length}`)
}

function crearClienteServiceRole() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.')
    console.error('Correr con: node --env-file=.env.local scripts/bulk-import-analisis-suelo.mjs ...')
    process.exit(1)
  }
  return createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ---------------------------------------------------------------------------
// Fase 1: dry-run (default) — camina, matchea, chequea duplicados, escribe CSV
// ---------------------------------------------------------------------------

async function runDryRun({ folder, ciclo, reportPath }) {
  const supabase = crearClienteServiceRole()

  console.log('\nCaminando la carpeta del backlog...')
  const { archivos, warnings } = await walkBacklog(folder)
  console.log(`  ${archivos.length} PDF(s) encontrados.`)
  for (const w of warnings) console.warn(`  ADVERTENCIA: ${w}`)

  const filasReporte = []
  const cacheExistentesPorAgricultor = new Map()

  for (const item of archivos) {
    process.stdout.write(`  matching: ${item.zona}/${item.carpetaAgricultor}/${item.archivo} ... `)

    const [matchesCarpeta, matchesArchivo] = await Promise.all([
      matchArchivoAAgricultor(supabase, item.carpetaAgricultor),
      matchArchivoAAgricultor(supabase, item.archivo),
    ])
    const clasif = clasificarMatch(matchesCarpeta, matchesArchivo)
    let decision = clasif.decision

    if (clasif.agricultor_key) {
      let existentes = cacheExistentesPorAgricultor.get(clasif.agricultor_key)
      if (!existentes) {
        const { data, error } = await supabase
          .from('lote_analisis_suelo')
          .select('nombre_archivo')
          .eq('agricultor_key', clasif.agricultor_key)
          .eq('ciclo', ciclo)
          .eq('categoria', 'analisis_suelo')
        if (error) {
          console.error(`\n    ! Error consultando duplicados para ${clasif.agricultor_key}: ${error.message}`)
          existentes = []
        } else {
          existentes = data ?? []
        }
        cacheExistentesPorAgricultor.set(clasif.agricultor_key, existentes)
      }
      if (esDuplicado(existentes, item.archivo)) {
        decision = 'SKIP_DUPLICADO'
      }
    }

    console.log(decision)

    filasReporte.push({
      zona: item.zona,
      carpeta_agricultor: item.carpetaAgricultor,
      archivo: item.archivo,
      ruta_absoluta: item.rutaAbsoluta,
      agricultor_key_sugerido: clasif.agricultor_key,
      nombre_sugerido: clasif.nombre_sugerido,
      confianza_carpeta: clasif.confianza_carpeta,
      confianza_archivo: clasif.confianza_archivo,
      decision,
    })
  }

  const reportAbs = path.resolve(reportPath)
  await mkdir(path.dirname(reportAbs), { recursive: true })
  await writeFile(reportAbs, filasACsv(filasReporte, REPORT_COLUMNS), 'utf8')

  console.log(`\nReporte escrito en: ${reportAbs}`)
  imprimirResumen(filasReporte)
  console.log('\nDRY-RUN: no se subió ni insertó nada en Supabase.')
  console.log(`Revisá/corregí el CSV a mano y volvé a correr con --commit --report="${reportPath}" para cargar.`)
}

// ---------------------------------------------------------------------------
// Fase 2: commit — relee el CSV revisado y sube sólo las filas aprobadas
// ---------------------------------------------------------------------------

async function subirYRegistrar(supabase, fila, ciclo) {
  let buffer
  try {
    buffer = await readFile(fila.ruta_absoluta)
  } catch (err) {
    return { ...fila, resultado: 'ERROR', mensaje: `No se pudo leer el archivo en disco: ${err.message}` }
  }

  const safe = fila.archivo.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
  const storagePath = `${fila.agricultor_key_sugerido}/${ciclo}/analisis_suelo/${Date.now()}_${safe}`

  const { error: upErr } = await supabase.storage
    .from('analisis-suelo')
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false })
  if (upErr) {
    return { ...fila, resultado: 'ERROR', mensaje: `Storage: ${upErr.message}` }
  }

  const { error: insErr } = await supabase.from('lote_analisis_suelo').insert({
    agricultor_key: fila.agricultor_key_sugerido,
    ciclo,
    categoria: 'analisis_suelo',
    lote_id: null,
    storage_path: storagePath,
    nombre_archivo: fila.archivo,
    tamano_bytes: buffer.length,
    es_vigente: true,
    uploaded_by: null,
  })

  if (insErr) {
    // Mismo patrón de rollback que app/api/documentos/upload/route.ts.
    await supabase.storage.from('analisis-suelo').remove([storagePath])
    return { ...fila, resultado: 'ERROR', mensaje: `Insert (rollback de storage hecho): ${insErr.message}` }
  }

  return { ...fila, resultado: 'OK', mensaje: storagePath }
}

const CONCURRENCIA_COMMIT = 4

async function runCommit({ ciclo, reportPath }) {
  const supabase = crearClienteServiceRole()

  const reportAbs = path.resolve(reportPath)
  console.log(`\nReleyendo reporte revisado: ${reportAbs}`)
  let texto
  try {
    texto = await readFile(reportAbs, 'utf8')
  } catch (err) {
    console.error(`No se pudo leer el reporte "${reportAbs}": ${err.message}`)
    process.exit(1)
  }

  const filas = csvAFilas(texto)
  console.log(`  ${filas.length} fila(s) en el reporte.`)

  const aprobadas = []
  const omitidas = []
  for (const fila of filas) {
    const tieneKey = fila.agricultor_key_sugerido && fila.agricultor_key_sugerido.trim() !== ''
    const aprobada = tieneKey && fila.decision !== 'SKIP_DUPLICADO' && fila.decision !== 'SIN_MATCH'
    if (aprobada) aprobadas.push(fila)
    else omitidas.push(fila)
  }
  console.log(`  ${aprobadas.length} fila(s) aprobadas para subir (AUTO_OK u override humano).`)
  console.log(`  ${omitidas.length} fila(s) omitidas (SIN_MATCH, SKIP_DUPLICADO, o sin agricultor_key_sugerido).`)

  const resultados = []
  let indice = 0
  async function trabajador() {
    while (indice < aprobadas.length) {
      const fila = aprobadas[indice++]
      const r = await subirYRegistrar(supabase, fila, ciclo)
      resultados.push(r)
      console.log(`  [${r.resultado}] ${fila.zona}/${fila.carpeta_agricultor}/${fila.archivo} -> ${fila.agricultor_key_sugerido}${r.mensaje ? ' :: ' + r.mensaje : ''}`)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCIA_COMMIT, aprobadas.length) }, () => trabajador()),
  )

  for (const fila of omitidas) {
    resultados.push({ ...fila, resultado: 'OMITIDO', mensaje: `decision=${fila.decision}` })
  }

  const resultPath = path.resolve('scripts', 'bulk-import-result.csv')
  await writeFile(resultPath, filasACsv(resultados, RESULT_COLUMNS), 'utf8')
  console.log(`\nResultado escrito en: ${resultPath}`)

  const ok = resultados.filter((r) => r.resultado === 'OK').length
  const errores = resultados.filter((r) => r.resultado === 'ERROR').length
  const omit = resultados.length - ok - errores
  console.log(`\nOK: ${ok}  ERROR: ${errores}  OMITIDO: ${omit}`)
  if (errores > 0) {
    console.error(`\n${errores} fila(s) fallaron. Revisar ${resultPath}.`)
    process.exitCode = 1
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const argv = parseArgs(process.argv.slice(2))

  if (!argv.folder) {
    console.error('Falta --folder=<ruta al backlog local>')
    console.error(usage())
    process.exit(1)
    return
  }
  const ciclo = argv.ciclo === true ? '' : String(argv.ciclo ?? '')
  if (!/^\d{4}$/.test(ciclo)) {
    console.error('Falta o es inválido --ciclo=<AAAA> (debe ser exactamente 4 dígitos; el ciclo nunca se infiere).')
    console.error(usage())
    process.exit(1)
    return
  }

  const folder = String(argv.folder)
  const commit = argv.commit === true || argv.commit === 'true'
  const reportPath = argv.report ? String(argv.report) : path.join('scripts', 'bulk-import-report.csv')

  console.log('== bulk-import-analisis-suelo ==')
  console.log(`Carpeta: ${folder}`)
  console.log(`Ciclo: ${ciclo}`)
  console.log(`Modo: ${commit ? 'COMMIT (escribe en Supabase)' : 'DRY-RUN (no escribe nada, es el modo por defecto)'}`)
  console.log(`Reporte: ${reportPath}`)

  if (commit) {
    await runCommit({ ciclo, reportPath })
  } else {
    await runDryRun({ folder, ciclo, reportPath })
  }
}

// Sólo correr main() cuando el archivo se ejecuta directamente (no cuando se
// importa, p. ej. desde un test, para reusar las funciones puras de arriba).
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error('\nError fatal:', err)
    process.exit(1)
  })
}
