/**
 * Descarga del histórico completo de clima de un agricultor en formato Excel.
 *
 * Permisos:
 *   - master: puede descargar el de cualquier agricultor vía ?agricultor=ID
 *   - farmer: solo puede descargar el suyo (ignora ?agricultor)
 *
 * Resuelve `codigo_estacion` vía el primer lote del agricultor que tenga
 * estación asignada (mismo criterio que `lib/clima.ts`). Si no tiene ninguna,
 * retorna 404 con mensaje claro — no hay histórico para descargar.
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
  const targetId = isMaster
    ? (parsed.data.agricultor ?? profile.agricultor_id)
    : profile.agricultor_id

  if (!targetId) {
    return NextResponse.json(
      { error: isMaster ? 'Falta seleccionar agricultor' : 'Sin agricultor asignado' },
      { status: 400 },
    )
  }

  const supabase = await createClient()

  // 3. Resolver nombre del agricultor + estación (primer lote con codigo_estacion asignado)
  const { data: agricultor } = await supabase
    .from('agricultores')
    .select('nombre')
    .eq('agricultor_id', targetId)
    .maybeSingle()

  if (!agricultor) {
    return NextResponse.json(
      { error: 'Agricultor no encontrado' },
      { status: 404 },
    )
  }

  const { data: loteConEstacion } = await supabase
    .from('lotes')
    .select('codigo_estacion')
    .eq('agricultor_id', targetId)
    .not('codigo_estacion', 'is', null)
    .limit(1)
    .maybeSingle()

  const codigoEstacion = loteConEstacion?.codigo_estacion ?? null
  if (!codigoEstacion) {
    return NextResponse.json(
      { error: 'Este agricultor no tiene estación meteorológica asignada.' },
      { status: 404 },
    )
  }

  const { data: estacion } = await supabase
    .from('estaciones')
    .select('station_id, station_name')
    .eq('codigo_estacion', codigoEstacion)
    .maybeSingle()

  // 4. Bajar TODAS las lecturas de la estación (paginado para evitar el límite 1000)
  type Reading = {
    fecha_hora: string
    temp_c: number | null
    temp_max_c: number | null
    temp_min_c: number | null
    hum_pct: number | null
    lluvia_mm: number | null
    tasa_lluvia_mm_h: number | null
    radiacion_w_m2: number | null
    viento_avg_kmh: number | null
    viento_max_kmh: number | null
    dir_viento: number | null
    barometro_inhg: number | null
    et_mm: number | null
  }
  const allRows: Reading[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('lecturas_live')
      .select(
        'fecha_hora, temp_c, temp_max_c, temp_min_c, hum_pct, lluvia_mm, tasa_lluvia_mm_h, radiacion_w_m2, viento_avg_kmh, viento_max_kmh, dir_viento, barometro_inhg, et_mm',
      )
      .eq('codigo_estacion', codigoEstacion)
      .order('fecha_hora', { ascending: true })
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
  const primera = allRows[0]?.fecha_hora
  const ultima = allRows[allRows.length - 1]?.fecha_hora
  const meta = [
    ['Campo', 'Valor'],
    ['Agricultor', agricultor.nombre ?? targetId],
    ['Estación', estacion?.station_name ?? codigoEstacion],
    ['Código de estación', codigoEstacion],
    ['Station ID', estacion?.station_id ?? '—'],
    ['Total lecturas', allRows.length],
    ['Primera lectura', primera ?? '—'],
    ['Última lectura', ultima ?? '—'],
    ['Generado', new Date().toISOString()],
  ]
  const wsMeta = XLSX.utils.aoa_to_sheet(meta)
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Información')

  // Hoja 2 — Lecturas (datos crudos por intervalo)
  const wsData = XLSX.utils.json_to_sheet(
    allRows.map(r => ({
      'Fecha y hora': r.fecha_hora,
      'Temperatura (°C)': r.temp_c,
      'Temp máxima (°C)': r.temp_max_c,
      'Temp mínima (°C)': r.temp_min_c,
      'Humedad (%)': r.hum_pct,
      'Lluvia (mm)': r.lluvia_mm,
      'Tasa lluvia (mm/h)': r.tasa_lluvia_mm_h,
      'Radiación (W/m²)': r.radiacion_w_m2,
      'Viento promedio (km/h)': r.viento_avg_kmh,
      'Viento máximo (km/h)': r.viento_max_kmh,
      'Dirección viento': r.dir_viento,
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
  const safeName = (agricultor.nombre ?? targetId)
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
