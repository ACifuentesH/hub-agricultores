#!/usr/bin/env node
/**
 * Migra los ~101 PDFs del módulo Documentación directo de bucket a bucket:
 * `analisis-suelo` (proyecto Supabase personal, ovcrjupneetifjasecko) →
 * `documentos` (proyecto Supabase organizacional). Alternativa a
 * `bulk-import-documentos.mjs` (que relee la carpeta local del backlog) para
 * cuando se prefiere copiar lo que YA está subido en vez de volver a
 * caminar el filesystem.
 *
 * La metadata vieja (`agropecuaria` y `lote_analisis_suelo`) no se lee en
 * vivo del proyecto viejo: se usan los CSV ya exportados en /demo-data
 * (`agropecuaria.csv`, `lote_analisis_suelo.csv`), que son un volcado real
 * de esas tablas. Lo único que se lee en vivo del proyecto viejo es el
 * archivo binario de cada PDF (Storage no está en los CSV).
 *
 * El problema central: `lote_analisis_suelo.storage_path` usa el
 * `AgricultorKey` viejo (texto, p. ej. "ELISABUSTAMANTE"), pero el bucket y
 * la tabla nuevos usan `agricultor_id` (uuid). No hay ninguna columna que
 * guarde el AgricultorKey viejo en el esquema nuevo, así que el mapeo se
 * resuelve así, por AgricultorKey (no por archivo):
 *   1) Por cédula (`agropecuaria.cedula` vs `agricultores.cedula`,
 *      normalizada igual que lib/cedula-auth.ts) — exacto, se usa siempre
 *      que la cédula vieja no esté vacía.
 *   2) Si no hay cédula: `match_archivo_a_agricultor(nombre_agropecuaria)`
 *      contra `agricultores.nombre` (similarity de pg_trgm) — igual mecanismo
 *      que usa el uploader en vivo, requiere haber corrido
 *      supabase/migrations/20260812130000_match_archivo_service_role.sql
 *      (el fix que permite llamar la RPC con service_role).
 *
 * Tres fases, todas dry-run salvo que se pida lo contrario:
 *   1) `--resolver` (default si no se pasa fase): resuelve agricultor_key→
 *      agricultor_id UNA VEZ por agricultor (no por archivo) y escribe
 *      scripts/migrate-documentos-agricultores.csv para revisión humana.
 *   2) `--commit --agricultores=<csv ya revisado>`: relee ese CSV (podés
 *      corregir agricultor_id_resuelto a mano en las filas REVISAR/SIN_MATCH)
 *      y, para cada agricultor aprobado, copia sus PDFs: descarga del bucket
 *      viejo, sube al nuevo, inserta en `documentos`. Detecta duplicados
 *      (mismo agricultor_id+ciclo+categoria+nombre_archivo ya en la tabla
 *      nueva) y los saltea — así se puede re-correr sin duplicar si se cortó
 *      a mitad de camino.
 *
 * Uso:
 *   node --env-file=.env.local scripts/migrate-documentos-bucket.mjs --resolver
 *   # revisar scripts/migrate-documentos-agricultores.csv
 *   node --env-file=.env.local scripts/migrate-documentos-bucket.mjs --commit --agricultores=scripts/migrate-documentos-agricultores.csv
 *
 * Requiere en el entorno (además de NEXT_PUBLIC_SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY del proyecto NUEVO, que ya están en .env.local):
 *   OLD_SUPABASE_URL=https://ovcrjupneetifjasecko.supabase.co
 *   OLD_SUPABASE_SERVICE_ROLE_KEY=<service_role key del proyecto viejo>
 * No commitear esas dos variables — agregalas a .env.local solo mientras
 * corrés este script y borralas después, o pasalas inline en la terminal.
 */

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
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
  node --env-file=.env.local scripts/migrate-documentos-bucket.mjs --resolver
  node --env-file=.env.local scripts/migrate-documentos-bucket.mjs --commit --agricultores=scripts/migrate-documentos-agricultores.csv

Requiere además OLD_SUPABASE_URL y OLD_SUPABASE_SERVICE_ROLE_KEY en el entorno
(proyecto Supabase personal, dueño del bucket "analisis-suelo").
`
}

// ---------------------------------------------------------------------------
// Cédula: misma normalización que lib/cedula-auth.ts (no se puede importar
// un .ts directo desde un script .mjs sin build step, así que se duplica a
// propósito — mantener en sync si cambia allá).
// ---------------------------------------------------------------------------

function normalizeCedula(raw) {
  const limpio = String(raw ?? '').trim().toUpperCase().replace(/[.\s-]/g, '')
  const sinPrefijo = limpio.replace(/^[VEJGP]/, '')
  return sinPrefijo.replace(/^0+(?=\d)/, '')
}

// ---------------------------------------------------------------------------
// CSV: lectura/escritura mínimas (RFC4180), sin dependencias nuevas — mismo
// parser que bulk-import-documentos.mjs.
// ---------------------------------------------------------------------------

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function filasACsv(filas, columnas) {
  const lineas = [columnas.join(',')]
  for (const fila of filas) lineas.push(columnas.map((c) => csvEscape(fila[c])).join(','))
  return lineas.join('\r\n') + '\r\n'
}

function csvAFilas(texto) {
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
        if (texto[i + 1] === '"') { campo += '"'; i += 2; continue }
        enComillas = false; i++; continue
      }
      campo += c; i++; continue
    }
    if (c === '"') { enComillas = true; i++; continue }
    if (c === ',') { fila.push(campo); campo = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { fila.push(campo); filasCrudas.push(fila); fila = []; campo = ''; i++; continue }
    campo += c; i++
  }
  if (campo.length > 0 || fila.length > 0) { fila.push(campo); filasCrudas.push(fila) }
  if (filasCrudas.length === 0) return []
  const headers = filasCrudas[0]
  return filasCrudas.slice(1)
    .filter((f) => !(f.length === 1 && f[0] === ''))
    .map((f) => Object.fromEntries(headers.map((h, idx) => [h, f[idx] ?? ''])))
}

// ---------------------------------------------------------------------------
// Clientes Supabase
// ---------------------------------------------------------------------------

function crearClienteNuevo() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (proyecto nuevo) en el entorno.')
    process.exit(1)
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function crearClienteViejo() {
  const url = process.env.OLD_SUPABASE_URL
  const key = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Faltan OLD_SUPABASE_URL / OLD_SUPABASE_SERVICE_ROLE_KEY (proyecto viejo) en el entorno.')
    console.error(usage())
    process.exit(1)
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ---------------------------------------------------------------------------
// Fase 1: resolver AgricultorKey → agricultor_id (una vez por agricultor)
// ---------------------------------------------------------------------------

const RESOLVER_COLUMNS = [
  'agricultor_key', 'nombre_agropecuaria', 'cedula_vieja', 'n_documentos',
  'metodo', 'agricultor_id_resuelto', 'nombre_resuelto', 'similitud', 'decision',
]

async function runResolver() {
  const nuevo = crearClienteNuevo()

  const agropecuariaCsv = await readFile(path.resolve('demo-data/agropecuaria.csv'), 'utf8')
  const docsCsv = await readFile(path.resolve('demo-data/lote_analisis_suelo.csv'), 'utf8')
  const agropecuaria = csvAFilas(agropecuariaCsv)
  const docs = csvAFilas(docsCsv)

  const porKey = new Map(agropecuaria.map((a) => [a.AgricultorKey, a]))
  const conteoDocs = new Map()
  for (const d of docs) conteoDocs.set(d.agricultor_key, (conteoDocs.get(d.agricultor_key) ?? 0) + 1)

  const { data: agricultoresNuevos, error: errAgr } = await nuevo
    .from('agricultores')
    .select('agricultor_id, nombre, cedula')
  if (errAgr) {
    console.error('No se pudo leer agricultores del proyecto nuevo:', errAgr.message)
    process.exit(1)
  }
  const porCedula = new Map()
  for (const a of agricultoresNuevos ?? []) {
    if (!a.cedula) continue
    porCedula.set(normalizeCedula(a.cedula), a)
  }

  const keysUnicas = [...conteoDocs.keys()].sort()
  console.log(`\n${keysUnicas.length} agricultor(es) único(s) con documentos a migrar.\n`)

  const filas = []
  for (const key of keysUnicas) {
    const agro = porKey.get(key)
    const nDocs = conteoDocs.get(key)
    if (!agro) {
      filas.push({
        agricultor_key: key, nombre_agropecuaria: '', cedula_vieja: '', n_documentos: nDocs,
        metodo: '', agricultor_id_resuelto: '', nombre_resuelto: '', similitud: '', decision: 'SIN_MATCH',
      })
      console.log(`  ${key}: SIN_MATCH (no está en demo-data/agropecuaria.csv)`)
      continue
    }

    const cedulaNorm = normalizeCedula(agro.cedula)
    let match = cedulaNorm ? porCedula.get(cedulaNorm) : null
    let metodo = match ? 'cedula' : ''
    let similitud = match ? 1 : null

    if (!match) {
      const { data, error } = await nuevo.rpc('match_archivo_a_agricultor', { filename: agro.nombre_agropecuaria })
      if (error) {
        console.error(`    ! Error en RPC para "${agro.nombre_agropecuaria}": ${error.message}`)
      } else if (Array.isArray(data) && data.length > 0) {
        match = { agricultor_id: data[0].agricultor_id, nombre: data[0].nombre }
        metodo = 'nombre'
        similitud = data[0].similitud
      }
    }

    const decision = !match ? 'SIN_MATCH' : metodo === 'cedula' ? 'AUTO_OK' : (similitud > 0.5 ? 'AUTO_OK' : 'REVISAR')

    filas.push({
      agricultor_key: key,
      nombre_agropecuaria: agro.nombre_agropecuaria,
      cedula_vieja: agro.cedula,
      n_documentos: nDocs,
      metodo,
      agricultor_id_resuelto: match?.agricultor_id ?? '',
      nombre_resuelto: match?.nombre ?? '',
      similitud: similitud ?? '',
      decision,
    })
    console.log(`  ${key} (${nDocs} doc) -> ${decision} ${match ? `[${metodo}] ${match.nombre}` : ''}`)
  }

  const reportPath = path.resolve('scripts/migrate-documentos-agricultores.csv')
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, filasACsv(filas, RESOLVER_COLUMNS), 'utf8')

  const autoOk = filas.filter((f) => f.decision === 'AUTO_OK').length
  const revisar = filas.filter((f) => f.decision === 'REVISAR').length
  const sinMatch = filas.filter((f) => f.decision === 'SIN_MATCH').length
  console.log(`\nAUTO_OK: ${autoOk}  REVISAR: ${revisar}  SIN_MATCH: ${sinMatch}`)
  console.log(`\nReporte escrito en: ${reportPath}`)
  console.log('Revisá REVISAR/SIN_MATCH (completá agricultor_id_resuelto a mano contra la tabla agricultores en Studio si hace falta),')
  console.log(`y después: node --env-file=.env.local scripts/migrate-documentos-bucket.mjs --commit --agricultores="${reportPath}"`)
}

// ---------------------------------------------------------------------------
// Fase 2: commit — copia los PDFs de los agricultores aprobados
// ---------------------------------------------------------------------------

async function copiarDocumento(viejo, nuevo, doc, agricultorId) {
  const { data: descargado, error: dlErr } = await viejo.storage
    .from('analisis-suelo')
    .download(doc.storage_path)
  if (dlErr || !descargado) {
    return { ok: false, error: `Descarga: ${dlErr?.message ?? 'sin datos'}` }
  }
  const buffer = Buffer.from(await descargado.arrayBuffer())

  const tail = path.basename(doc.storage_path)
  const nuevoPath = `${agricultorId}/${doc.ciclo}/${doc.categoria}/${tail}`

  // Idempotente: si ya existe (mismo agricultor+ciclo+categoria+nombre), saltear.
  const { data: existente } = await nuevo
    .from('documentos')
    .select('id')
    .eq('agricultor_id', agricultorId)
    .eq('ciclo', doc.ciclo)
    .eq('categoria', doc.categoria)
    .eq('nombre_archivo', doc.nombre_archivo)
    .maybeSingle()
  if (existente) {
    return { ok: true, skipped: true }
  }

  const { error: upErr } = await nuevo.storage
    .from('documentos')
    .upload(nuevoPath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    })
  if (upErr) {
    return { ok: false, error: `Subida: ${upErr.message}` }
  }

  const { error: insErr } = await nuevo.from('documentos').insert({
    agricultor_id: agricultorId,
    ciclo: doc.ciclo,
    categoria: doc.categoria,
    lote_id: null,
    storage_path: nuevoPath,
    nombre_archivo: doc.nombre_archivo,
    tamano_bytes: buffer.length,
    es_vigente: doc.es_vigente?.toLowerCase?.() !== 'false',
    uploaded_by: null,
    uploaded_at: doc.uploaded_at || undefined,
  })
  if (insErr) {
    await nuevo.storage.from('documentos').remove([nuevoPath])
    return { ok: false, error: `Insert (rollback de storage hecho): ${insErr.message}` }
  }

  return { ok: true, skipped: false, path: nuevoPath }
}

async function runCommit({ agricultoresPath }) {
  const viejo = crearClienteViejo()
  const nuevo = crearClienteNuevo()

  const agricultoresTexto = await readFile(path.resolve(agricultoresPath), 'utf8')
  const agricultoresFilas = csvAFilas(agricultoresTexto)
  const mapaAprobados = new Map()
  for (const f of agricultoresFilas) {
    if (f.agricultor_id_resuelto && f.agricultor_id_resuelto.trim() !== '') {
      mapaAprobados.set(f.agricultor_key, f.agricultor_id_resuelto.trim())
    }
  }
  console.log(`\n${mapaAprobados.size} agricultor(es) con agricultor_id aprobado de ${agricultoresFilas.length} en el CSV.`)

  const docsCsv = await readFile(path.resolve('demo-data/lote_analisis_suelo.csv'), 'utf8')
  const docs = csvAFilas(docsCsv)

  const resultados = []
  for (const doc of docs) {
    const agricultorId = mapaAprobados.get(doc.agricultor_key)
    if (!agricultorId) {
      resultados.push({ ...doc, resultado: 'OMITIDO', mensaje: 'agricultor sin agricultor_id aprobado' })
      console.log(`  [OMITIDO] ${doc.storage_path} (${doc.agricultor_key} sin match aprobado)`)
      continue
    }
    const r = await copiarDocumento(viejo, nuevo, doc, agricultorId)
    if (!r.ok) {
      resultados.push({ ...doc, resultado: 'ERROR', mensaje: r.error })
      console.log(`  [ERROR] ${doc.storage_path} :: ${r.error}`)
    } else if (r.skipped) {
      resultados.push({ ...doc, resultado: 'SKIP_YA_EXISTIA', mensaje: '' })
      console.log(`  [SKIP] ${doc.storage_path} (ya estaba en el proyecto nuevo)`)
    } else {
      resultados.push({ ...doc, resultado: 'OK', mensaje: r.path })
      console.log(`  [OK] ${doc.storage_path} -> ${r.path}`)
    }
  }

  const resultPath = path.resolve('scripts/migrate-documentos-result.csv')
  const columnas = ['id', 'agricultor_key', 'ciclo', 'storage_path', 'nombre_archivo', 'tamano_bytes', 'uploaded_at', 'categoria', 'resultado', 'mensaje']
  await writeFile(resultPath, filasACsv(resultados, columnas), 'utf8')

  const ok = resultados.filter((r) => r.resultado === 'OK').length
  const skip = resultados.filter((r) => r.resultado === 'SKIP_YA_EXISTIA').length
  const errores = resultados.filter((r) => r.resultado === 'ERROR').length
  const omit = resultados.filter((r) => r.resultado === 'OMITIDO').length
  console.log(`\nOK: ${ok}  SKIP (ya existía): ${skip}  ERROR: ${errores}  OMITIDO: ${omit}`)
  console.log(`Resultado escrito en: ${resultPath}`)
  if (errores > 0) process.exitCode = 1
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const argv = parseArgs(process.argv.slice(2))
  const commit = argv.commit === true || argv.commit === 'true'

  console.log('== migrate-documentos-bucket ==')
  console.log(`Modo: ${commit ? 'COMMIT (copia de verdad)' : 'RESOLVER (solo arma el CSV de mapeo, no toca Storage/tabla)'}`)

  if (commit) {
    if (!argv.agricultores) {
      console.error('Falta --agricultores=<ruta al CSV ya revisado>')
      console.error(usage())
      process.exit(1)
    }
    await runCommit({ agricultoresPath: String(argv.agricultores) })
  } else {
    await runResolver()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error('\nError fatal:', err)
    process.exit(1)
  })
}
