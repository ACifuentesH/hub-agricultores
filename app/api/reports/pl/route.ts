import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

/**
 * Estado de resultados (P&L) del agricultor, en Excel.
 *
 * Los datos vienen de `pl_unidad`, que se rellena desde el espejo de Saturno en
 * cada sincronización. Se consulta con el cliente RLS del usuario: un agricultor
 * solo obtiene sus propias unidades; el master puede pedir las de otro con
 * ?agricultor=KEY.
 */
export async function GET(req: Request) {
  const profile = await getUserProfile()
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const pedido = url.searchParams.get('agricultor')?.trim() || null
  // Un farmer nunca puede pedir el P&L de otro: se ignora el parámetro.
  const agricultorKey = profile.role === 'master' ? (pedido ?? profile.agricultor_key) : profile.agricultor_key
  if (!agricultorKey) {
    return NextResponse.json({ ok: false, error: 'Falta el agricultor' }, { status: 400 })
  }

  const supabase = await createClient()
  const [{ data: filas }, { data: agro }] = await Promise.all([
    supabase
      .from('pl_unidad')
      .select('*')
      .eq('agricultor_key', agricultorKey)
      .order('codigo_up'),
    supabase
      .from('agropecuaria')
      .select('nombre_agropecuaria')
      .eq('AgricultorKey', agricultorKey)
      .maybeSingle(),
  ])

  if (!filas?.length) {
    return NextResponse.json(
      { ok: false, error: 'Todavía no hay datos de costos para este agricultor.' },
      { status: 404 },
    )
  }

  const nombre = agro?.nombre_agropecuaria ?? agricultorKey
  const ciclo = filas[0].ciclo
  const n = (v: unknown) => Number(v ?? 0)
  const suma = (campo: string) => filas.reduce((s, f) => s + n((f as Record<string, unknown>)[campo]), 0)

  const costoTotal = suma('costo_total')
  const ingreso = suma('ingreso_venta')
  const utilidad = suma('utilidad_agricultor')
  const haTotales = suma('ha_totales')

  const wb = XLSX.utils.book_new()

  // Hoja 1 — Resumen. Si no hay ingresos aún, se dice explícitamente para que
  // nadie interprete la utilidad negativa como una pérdida ya materializada.
  const resumen: (string | number)[][] = [
    ['ESTADO DE RESULTADOS'],
    ['Agricultor', nombre],
    ['Ciclo', ciclo],
    ['Unidades de producción', filas.length],
    ['Hectáreas totales', haTotales],
    [],
    ['CONCEPTO', 'MONTO (USD)'],
    ['Semillas', suma('costo_semillas')],
    ['Agroquímicos', suma('costo_agroquimicos')],
    ['Fertilizantes', suma('costo_fertilizantes')],
    ['Enmiendas', suma('costo_enmienda')],
    ['Mecanización', suma('costo_mecanizacion')],
    ['Servicio técnico', suma('costo_servicio_tecnico')],
    ['Financiamiento', suma('costo_financiamiento')],
    ['Cosecha', suma('costo_cosecha')],
    ['COSTO TOTAL', costoTotal],
    [],
    ['Ingreso por venta', ingreso],
    ['Utilidad del agricultor', utilidad],
    ['Costo por hectárea', haTotales > 0 ? +(costoTotal / haTotales).toFixed(2) : 0],
  ]

  if (ingreso === 0) {
    resumen.push(
      [],
      ['NOTA'],
      ['El ciclo aún no registra ingresos por venta, así que la utilidad'],
      ['mostrada refleja únicamente los costos incurridos hasta la fecha.'],
      ['No corresponde a una pérdida definitiva del ciclo.'],
    )
  }

  const ws1 = XLSX.utils.aoa_to_sheet(resumen)
  ws1['!cols'] = [{ wch: 32 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen')

  // Hoja 2 — Detalle por unidad de producción
  const ws2 = XLSX.utils.json_to_sheet(
    filas.map(f => ({
      'Unidad': f.codigo_up,
      'Nombre': f.nombre_up ?? '',
      'Hectáreas': n(f.ha_totales),
      'Semillas': n(f.costo_semillas),
      'Agroquímicos': n(f.costo_agroquimicos),
      'Fertilizantes': n(f.costo_fertilizantes),
      'Enmiendas': n(f.costo_enmienda),
      'Mecanización': n(f.costo_mecanizacion),
      'Servicio técnico': n(f.costo_servicio_tecnico),
      'Financiamiento': n(f.costo_financiamiento),
      'Cosecha': n(f.costo_cosecha),
      'Costo total': n(f.costo_total),
      'Ingreso venta': n(f.ingreso_venta),
      'Utilidad': n(f.utilidad_agricultor),
      'Rendimiento (t/ha)': f.rendimiento_ha ?? '',
    })),
  )
  ws2['!cols'] = Array.from({ length: 15 }, (_, i) => ({ wch: i <= 1 ? 24 : 15 }))
  XLSX.utils.book_append_sheet(wb, ws2, 'Por unidad')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const archivo = `P&L_${nombre.replace(/[^a-zA-Z0-9]/g, '_')}_${ciclo}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${archivo}"`,
    },
  })
}
