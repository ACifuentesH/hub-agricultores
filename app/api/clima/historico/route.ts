/**
 * Descarga del histórico completo de clima de un agricultor en formato Excel.
 *
 * Permisos:
 *   - master: puede descargar el de cualquier agricultor vía ?agricultor=KEY
 *   - farmer: solo puede descargar el suyo (ignora ?agricultor)
 *
 * Resuelve station_id vía la vista v_clima_efectivo. Si el agricultor no tiene
 * estación Davis directa (es triangulado o sin_datos), retorna 404 con mensaje
 * claro — no hay histórico para descargar.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { z } from 'zod'

const querySchema = z.object({
  agricultor: z.string().min(1).max(100).optional(),
})

export async function GET(request: NextRequest) {
  // 1. Auth
  const profile = await getUserProfile()
  if (!profile) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // 2. Resolver agricultor según rol
  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    agricultor: searchParams.get('agricultor') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const isMaster = profile.role === 'master'
  const targetKey = isMaster
    ? (parsed.data.agricultor ?? profile.agricultor_key)
    : profile.agricultor_key

  if (!targetKey) {
    return NextResponse.json(
      { error: isMaster ? 'Falta seleccionar agricultor' : 'Sin agricultor asignado' },
      { status: 400 },
    )
  }

  const supabase = await createClient()

  // 3. Resolver la estación + nombre del agricultor desde v_clima_efectivo
  const { data: efectivo } = await supabase
    .from('v_clima_efectivo')
    .select('nombre_agropecuaria, fuente, station_id, davis_key')
    .eq('agricultor_key', targetKey)
    .maybeSingle()

  if (!efectivo) {
    return NextResponse.json(
      { error: 'Agricultor no encontrado' },
      { status: 404 },
    )
  }

  if (efectivo.fuente !== 'davis' || !efectivo.station_id) {
    return NextResponse.json(
      {
        error: efectivo.fuente === 'triangulated'
          ? 'Este agricultor recibe clima triangulado, no tiene histórico propio para descargar.'
          : 'Este agricultor no tiene estación meteorológica asignada.',
      },
      { status: 404 },
    )
  }

  // 4. Bajar TODAS las lecturas de la estación (paginado para evitar el límite 1000)
  type Reading = {
    fecha_hora: string
    ts: number
    temp_c: number | null
    temp_max_c: number | null
    temp_min_c: number | null
    hum_pct: number | null
    hum_max_pct: number | null
    hum_min_pct: number | null
    lluvia_mm: number | null
    tasa_lluvia_mm_h: number | null
    radiacion_w_m2: number | null
    radiacion_max_w_m2: number | null
    viento_avg_kmh: number | null
    viento_max_kmh: number | null
    dir_viento: number | null
    punto_rocio_c: number | null
    barometro_inhg: number | null
    et_mm: number | null
  }
  const allRows: Reading[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('weather_readings')
      .select(
        'fecha_hora, ts, temp_c, temp_max_c, temp_min_c, hum_pct, hum_max_pct, hum_min_pct, lluvia_mm, tasa_lluvia_mm_h, radiacion_w_m2, radiacion_max_w_m2, viento_avg_kmh, viento_max_kmh, dir_viento, punto_rocio_c, barometro_inhg, et_mm',
      )
      .eq('station_id', efectivo.station_id)
      .order('ts', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) break
    allRows.push(...(data as Reading[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  if (allRows.length === 0) {
    return NextResponse.json(
      { error: 'No hay lecturas históricas todavía para esta estación.' },
      { status: 404 },
    )
  }

  // 5. Generar Excel
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  // Hoja 1 — Metadata
  const minTs = allRows[0]?.ts
  const maxTs = allRows[allRows.length - 1]?.ts
  const meta = [
    ['Campo', 'Valor'],
    ['Agricultor', efectivo.nombre_agropecuaria ?? targetKey],
    ['Estación Davis', efectivo.davis_key ?? '—'],
    ['Station ID', efectivo.station_id],
    ['Total lecturas', allRows.length],
    ['Primera lectura', minTs ? new Date(minTs * 1000).toISOString() : '—'],
    ['Última lectura', maxTs ? new Date(maxTs * 1000).toISOString() : '—'],
    ['Generado', new Date().toISOString()],
  ]
  const wsMeta = XLSX.utils.aoa_to_sheet(meta)
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Información')

  // Hoja 2 — Lecturas (datos crudos por intervalo)
  const wsData = XLSX.utils.json_to_sheet(
    allRows.map(r => ({
      'Fecha y hora (UTC)': r.fecha_hora,
      'Temperatura (°C)': r.temp_c,
      'Temp máxima (°C)': r.temp_max_c,
      'Temp mínima (°C)': r.temp_min_c,
      'Humedad (%)': r.hum_pct,
      'Humedad máx (%)': r.hum_max_pct,
      'Humedad mín (%)': r.hum_min_pct,
      'Lluvia (mm)': r.lluvia_mm,
      'Tasa lluvia (mm/h)': r.tasa_lluvia_mm_h,
      'Radiación (W/m²)': r.radiacion_w_m2,
      'Radiación máx (W/m²)': r.radiacion_max_w_m2,
      'Viento promedio (km/h)': r.viento_avg_kmh,
      'Viento máximo (km/h)': r.viento_max_kmh,
      'Dirección viento': r.dir_viento,
      'Punto de rocío (°C)': r.punto_rocio_c,
      'Barómetro (inHg)': r.barometro_inhg,
      'Evapotranspiración (mm)': r.et_mm,
    })),
  )
  XLSX.utils.book_append_sheet(wb, wsData, 'Lecturas')

  // Hoja 3 — Resumen diario (agregado)
  type DayAgg = {
    fecha: string
    temp_avg: number[]
    temp_max: number[]
    temp_min: number[]
    hum_avg: number[]
    lluvia: number[]
  }
  const byDay = new Map<string, DayAgg>()
  for (const r of allRows) {
    const d = (r.fecha_hora ?? '').slice(0, 10)
    if (!d) continue
    let bucket = byDay.get(d)
    if (!bucket) {
      bucket = { fecha: d, temp_avg: [], temp_max: [], temp_min: [], hum_avg: [], lluvia: [] }
      byDay.set(d, bucket)
    }
    if (r.temp_c != null) bucket.temp_avg.push(r.temp_c)
    if (r.temp_max_c != null) bucket.temp_max.push(r.temp_max_c)
    if (r.temp_min_c != null) bucket.temp_min.push(r.temp_min_c)
    if (r.hum_pct != null) bucket.hum_avg.push(r.hum_pct)
    if (r.lluvia_mm != null) bucket.lluvia.push(r.lluvia_mm)
  }
  const avg = (xs: number[]) => xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null
  const sum = (xs: number[]) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100 : null
  const max = (xs: number[]) => xs.length ? Math.max(...xs) : null
  const min = (xs: number[]) => xs.length ? Math.min(...xs) : null
  const wsDay = XLSX.utils.json_to_sheet(
    Array.from(byDay.values()).map(d => ({
      'Fecha': d.fecha,
      'Temp promedio (°C)': avg(d.temp_avg),
      'Temp máx día (°C)': max(d.temp_max),
      'Temp mín día (°C)': min(d.temp_min),
      'Humedad promedio (%)': avg(d.hum_avg),
      'Lluvia acumulada (mm)': sum(d.lluvia),
    })),
  )
  XLSX.utils.book_append_sheet(wb, wsDay, 'Resumen diario')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const safeName = (efectivo.nombre_agropecuaria ?? targetKey)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 60)
  const dateStamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="clima_historico_${safeName}_${dateStamp}.xlsx"`,
    },
  })
}
