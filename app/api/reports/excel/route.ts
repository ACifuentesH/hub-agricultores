import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const querySchema = z.object({
  loteId: z.string().min(1).max(100),
  loteName: z.string().min(1).max(200),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    loteId: searchParams.get('loteId'),
    loteName: searchParams.get('loteName'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { loteId, loteName } = parsed.data

  const [{ data: lote }, { data: insumos }] = await Promise.all([
    supabase.from('lote').select('*').eq('lote_id', loteId).single(),
    supabase.from('producto_registro')
      .select('nombre_producto, categoria_producto, dosis_real_ha, dosis_recomendada_v, ha_aplicadas, costo_real, fecha_registro')
      .eq('lote_v', loteName)
      .limit(100),
  ])

  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  // Sheet 1: Lote info
  if (lote) {
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['Campo', 'Valor'],
      ['Nombre lote', lote.nombre_lote],
      ['Código lote', lote.codigo_lote],
      ['Ha sembradas', lote.ha_sembradas],
      ['Inicio siembra', lote.fecha_inicio_siembra_real],
      ['Ha perdidas', lote.ha_perdidas],
      ['Ha cosechadas', lote.ha_cosechadas],
      ['Estado cultivo', lote.edo_gral_cultivo_v],
      ['Rendimiento real', lote.rendimiento_real],
    ])
    XLSX.utils.book_append_sheet(wb, ws1, 'Lote')
  }

  // Sheet 2: Insumos
  if (insumos && insumos.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(insumos.map(i => ({
      Producto: i.nombre_producto,
      Categoría: i.categoria_producto,
      'Dosis real/ha': i.dosis_real_ha,
      'Dosis recomendada/ha': i.dosis_recomendada_v,
      'Ha aplicadas': i.ha_aplicadas,
      'Costo real': i.costo_real,
      Fecha: i.fecha_registro ? new Date(i.fecha_registro).toLocaleDateString('es-VE') : '',
    })))
    XLSX.utils.book_append_sheet(wb, ws2, 'Insumos')
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reporte_${loteName.replace(/\s/g, '_')}.xlsx"`,
    },
  })
}
