/**
 * Asistente propio — determinista, sin IA externa.
 *
 * Por qué así: el asistente anterior dependía de Gemini y de una API key que no
 * se va a subir, de modo que en producción no respondía. Este motor lee los
 * datos REALES del productor y los combina con textos escritos por humanos
 * (lib/agro-glosario.ts). Consecuencias buscadas:
 *   - cero costo y cero API keys
 *   - nunca inventa cifras: todo número que dice sale de la base
 *   - si no entiende, lo admite y enumera lo que sí sabe hacer
 *
 * Todas las consultas usan el cliente de servidor con la sesión del usuario, así
 * que la RLS garantiza que un agricultor solo pueda leer lo suyo.
 */

import { createClient } from './supabase/server'
import { getCurrentStageInfo, STAGE_META, type Stage } from './corn-stages'
import { getCurrentConditions, getForecast, computeAlerts } from './clima'
import {
  FASE_EXPLICACION, ETAPA_ALIAS, DOC_EXPLICACION, FUENTE_EXPLICACION,
  MODULOS, CANALES_AYUDA,
} from './agro-glosario'
import { CATEGORIAS, labelCategoria } from './documentos'
import { formatDateShort, freshnessLevel } from './freshness'

export interface RespuestaAsistente {
  texto: string
  /** Intención detectada — útil para depurar y para telemetría futura. */
  intencion: string
}

/**
 * Marcas diacríticas combinantes (U+0300–U+036F) que deja `normalize('NFD')`.
 * Se construye desde cadena para no depender de caracteres invisibles en el
 * código fuente.
 */
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')

/** Minúsculas y sin acentos, para comparar palabras clave de forma robusta. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function incluyeAlguna(txt: string, palabras: string[]): boolean {
  return palabras.some(p => txt.includes(p))
}

export async function responder(
  pregunta: string,
  agricultorKey: string | null,
  ciclo: string,
): Promise<RespuestaAsistente> {
  const q = normalizar(pregunta)

  if (!agricultorKey) {
    return {
      intencion: 'sin_agricultor',
      texto: 'Primero selecciona un agricultor para que pueda consultar sus datos.',
    }
  }

  // 0) Orientación sobre la app. Va PRIMERO porque "dónde veo X" es la duda más
  //    común de quien tiene poca práctica con apps, y no debe caer en el fallback.
  const pideOrientacion = incluyeAlguna(q, [
    'que puedo hacer', 'que hay en', 'para que sirve', 'donde veo', 'donde esta',
    'donde encuentro', 'como uso', 'como funciona la app', 'ayuda', 'no encuentro',
    'que es esta app', 'guiame', 'modulos', 'menu', 'secciones',
  ])
  if (pideOrientacion) {
    // ¿Pregunta por un módulo concreto?
    const mod = MODULOS.find(m => incluyeAlguna(q, m.palabras))
    if (mod && !incluyeAlguna(q, ['que puedo hacer', 'que es esta app', 'modulos', 'secciones'])) {
      return {
        intencion: 'orientacion_modulo',
        texto:
          `${mod.nombre} — ${mod.ruta}\n\n${mod.resumen}\n\nAhí encuentras:\n` +
          mod.contiene.map(c => `• ${c}`).join('\n'),
      }
    }
    return {
      intencion: 'orientacion_general',
      texto:
        'La app tiene cuatro secciones, en el menú de la izquierda:\n\n' +
        MODULOS.map(m => `• ${m.nombre}: ${m.resumen}`).join('\n\n') +
        `\n\n${CANALES_AYUDA}\n\n` +
        'Si quieres saber más de una sección, pregúntame por ella.',
    }
  }

  // 1) Definición de una etapa concreta ("¿qué es el llenado de grano?").
  //    Va ANTES de la etapa actual: si preguntan "qué es X" quieren la teoría.
  const preguntaDefinicion = incluyeAlguna(q, ['que es', 'que significa', 'explicame', 'explica', 'en que consiste'])
  if (preguntaDefinicion) {
    const alias = ETAPA_ALIAS.find(a => incluyeAlguna(q, a.palabras))
    if (alias) {
      const meta = STAGE_META[alias.stage]
      return {
        intencion: 'definicion_etapa',
        texto: `${meta.label} — ${meta.phase} (${meta.range} desde la siembra)\n\n${FASE_EXPLICACION[alias.stage]}`,
      }
    }
    const cat = CATEGORIAS.find(c => incluyeAlguna(q, [normalizar(c.label)]))
    if (cat) {
      return { intencion: 'definicion_documento', texto: DOC_EXPLICACION[cat.id] }
    }
  }

  // 2) Etapa actual de MIS lotes
  if (incluyeAlguna(q, ['etapa', 'fase', 'como esta mi cultivo', 'mi cultivo', 'fenologia'])) {
    return await responderEtapa(agricultorKey, ciclo)
  }

  // 3) Mis lotes
  if (incluyeAlguna(q, ['lote', 'lotes', 'hectarea', 'hectareas', 'cuanto sembre', 'siembra'])) {
    return await responderLotes(agricultorKey, ciclo)
  }

  // 4) Mis documentos
  if (incluyeAlguna(q, ['documento', 'documentos', 'archivo', 'archivos', 'analisis', 'mapa', 'convenio', 'caso de negocio', 'pdf'])) {
    return await responderDocumentos(agricultorKey, ciclo)
  }

  // 5) Alertas (antes que clima: "alerta de lluvia" debe ir a alertas)
  if (incluyeAlguna(q, ['alerta', 'alertas', 'riesgo', 'aviso', 'peligro'])) {
    return await responderAlertas(agricultorKey)
  }

  // 6) Clima actual
  if (incluyeAlguna(q, ['clima', 'temperatura', 'lluvia', 'llueve', 'humedad', 'pronostico', 'tiempo'])) {
    return await responderClima(agricultorKey)
  }

  // 7) Fallback honesto
  return {
    intencion: 'fallback',
    texto:
      'No tengo una respuesta para eso todavía. Puedo ayudarte con:\n\n' +
      '• Qué hay en cada sección de la app y dónde encontrarlo\n' +
      '• En qué etapa está tu cultivo y qué significa\n' +
      '• Cuántos lotes y hectáreas tienes en el ciclo\n' +
      '• Qué documentos hay cargados en tu perfil\n' +
      '• El clima de tu finca y de dónde sale ese dato\n' +
      '• Las alertas de la semana\n\n' +
      CANALES_AYUDA,
  }
}

async function responderEtapa(agricultorKey: string, ciclo: string): Promise<RespuestaAsistente> {
  const supabase = await createClient()
  const { data: lotes } = await supabase
    .from('lote')
    .select('nombre_lote, fecha_inicio_siembra_real')
    .eq('AgricultorKey', agricultorKey)
    .eq('ciclo', ciclo)

  if (!lotes?.length) {
    return { intencion: 'etapa', texto: `No tienes lotes registrados en el ciclo ${ciclo}.` }
  }

  const conFecha = lotes.filter(l => l.fecha_inicio_siembra_real)
  const sinFecha = lotes.length - conFecha.length

  if (!conFecha.length) {
    return {
      intencion: 'etapa',
      texto:
        `Tus ${lotes.length} lotes del ciclo ${ciclo} todavía no tienen fecha de siembra confirmada, ` +
        'así que no puedo calcular la etapa. El equipo agronómico debe cargarla.',
    }
  }

  // Agrupar por etapa para no listar 300 lotes uno por uno
  const porEtapa = new Map<Stage, string[]>()
  for (const l of conFecha) {
    const info = getCurrentStageInfo(l.fecha_inicio_siembra_real)
    if (!info) continue
    const arr = porEtapa.get(info.stage) ?? []
    arr.push(l.nombre_lote as string)
    porEtapa.set(info.stage, arr)
  }

  const lineas: string[] = []
  const etapas = [...porEtapa.keys()].sort((a, b) => a - b)
  for (const st of etapas) {
    const nombres = porEtapa.get(st)!
    const meta = STAGE_META[st]
    const muestra = nombres.slice(0, 3).join(', ')
    const resto = nombres.length > 3 ? ` y ${nombres.length - 3} más` : ''
    lineas.push(`• ${meta.label} — ${meta.phase}: ${nombres.length} lote${nombres.length === 1 ? '' : 's'} (${muestra}${resto})`)
  }

  // Explicación de la etapa donde está la mayoría
  const dominante = etapas.reduce((a, b) => (porEtapa.get(b)!.length > porEtapa.get(a)!.length ? b : a), etapas[0])

  let texto = `Etapa de tus lotes en el ciclo ${ciclo}:\n\n${lineas.join('\n')}`
  if (sinFecha > 0) {
    texto += `\n\n${sinFecha} lote${sinFecha === 1 ? '' : 's'} sin fecha de siembra confirmada, así que no entran en el cálculo.`
  }
  texto += `\n\n${FASE_EXPLICACION[dominante]}`

  return { intencion: 'etapa', texto }
}

async function responderLotes(agricultorKey: string, ciclo: string): Promise<RespuestaAsistente> {
  const supabase = await createClient()
  const { data: lotes } = await supabase
    .from('lote')
    .select('nombre_lote, ha_sembradas, fecha_inicio_siembra_real')
    .eq('AgricultorKey', agricultorKey)
    .eq('ciclo', ciclo)

  if (!lotes?.length) {
    return { intencion: 'lotes', texto: `No tienes lotes registrados en el ciclo ${ciclo}.` }
  }

  const totalHa = lotes.reduce((s, l) => s + (parseFloat(l.ha_sembradas ?? '0') || 0), 0)
  const conFecha = lotes.filter(l => l.fecha_inicio_siembra_real).length

  let texto =
    `En el ciclo ${ciclo} tienes ${lotes.length} lote${lotes.length === 1 ? '' : 's'} ` +
    `con ${totalHa.toFixed(1)} hectáreas sembradas en total.`

  if (conFecha < lotes.length) {
    texto += `\n\nDe esos, ${conFecha} tiene${conFecha === 1 ? '' : 'n'} fecha de siembra confirmada; ` +
      `a ${lotes.length - conFecha} les falta cargarla, y por eso no aparecen en la línea de tiempo del cultivo.`
  }

  return { intencion: 'lotes', texto }
}

async function responderDocumentos(agricultorKey: string, ciclo: string): Promise<RespuestaAsistente> {
  const supabase = await createClient()
  const { data: docs } = await supabase
    .from('lote_analisis_suelo')
    .select('categoria, nombre_archivo, uploaded_at')
    .eq('agricultor_key', agricultorKey)
    .eq('ciclo', ciclo)
    .order('uploaded_at', { ascending: false })

  if (!docs?.length) {
    return {
      intencion: 'documentos',
      texto: `No hay documentos cargados para el ciclo ${ciclo} todavía. Cuando el equipo los suba, aparecerán en el módulo Documentación.`,
    }
  }

  const conteo = new Map<string, number>()
  for (const d of docs) conteo.set(d.categoria as string, (conteo.get(d.categoria as string) ?? 0) + 1)

  const lineas = [...conteo.entries()].map(([cat, n]) => `• ${labelCategoria(cat)}: ${n}`)
  const ultimo = docs[0]

  return {
    intencion: 'documentos',
    texto:
      `Tienes ${docs.length} documento${docs.length === 1 ? '' : 's'} en el ciclo ${ciclo}:\n\n${lineas.join('\n')}\n\n` +
      `El más reciente es «${ultimo.nombre_archivo}» (${formatDateShort(ultimo.uploaded_at)}). ` +
      'Puedes descargarlos desde el módulo Documentación.',
  }
}

async function responderClima(agricultorKey: string): Promise<RespuestaAsistente> {
  const c = await getCurrentConditions(agricultorKey)

  if (c.tempC == null) {
    return {
      intencion: 'clima',
      texto: FUENTE_EXPLICACION[c.source.fuente] ?? 'No hay datos de clima disponibles para tu finca.',
    }
  }

  const partes = [`Temperatura: ${c.tempC.toFixed(1)}°C`]
  if (c.humPct != null) partes.push(`Humedad: ${c.humPct.toFixed(0)}%`)
  if (c.lluviaMm != null) partes.push(`Lluvia: ${c.lluviaMm.toFixed(1)} mm`)

  const nivel = freshnessLevel(c.fecha)
  const cuando =
    nivel === 'fresh'
      ? 'Lectura actualizada.'
      : `Ojo: la última lectura es del ${formatDateShort(c.fecha)}, así que el dato no está al día.`

  return {
    intencion: 'clima',
    texto: `${partes.join(' · ')}\n\n${cuando}\n\n${FUENTE_EXPLICACION[c.source.fuente] ?? ''}`.trim(),
  }
}

async function responderAlertas(agricultorKey: string): Promise<RespuestaAsistente> {
  const forecast = await getForecast(agricultorKey, 7)
  const alertas = computeAlerts(forecast.rows)

  if (!alertas.length) {
    return {
      intencion: 'alertas',
      texto: forecast.rows.length
        ? 'No hay alertas para los próximos días: ni lluvias fuertes, ni calor extremo, ni vientos de riesgo en el pronóstico.'
        : 'No tengo pronóstico disponible para tu finca, así que no puedo calcular alertas. El pronóstico requiere una estación Davis asignada.',
    }
  }

  const lineas = alertas.slice(0, 5).map(a => `• ${a.title}: ${a.detail}`)
  return {
    intencion: 'alertas',
    texto: `Tienes ${alertas.length} alerta${alertas.length === 1 ? '' : 's'} en el pronóstico:\n\n${lineas.join('\n')}`,
  }
}
