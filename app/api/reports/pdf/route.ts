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

  const { data: lote } = await supabase
    .from('lote')
    .select('*')
    .eq('lote_id', loteId)
    .single()

  const { data: insumos } = await supabase
    .from('producto_registro')
    .select('nombre_producto, categoria_producto, dosis_real_ha, ha_aplicadas, fecha_registro')
    .eq('lote_v', loteName)
    .limit(50)

  // Build PDF using jsPDF
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.text('Reporte de Lote', 14, 22)
  doc.setFontSize(12)
  doc.text(`Lote: ${loteName}`, 14, 32)
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-VE')}`, 14, 40)

  if (lote) {
    doc.setFontSize(11)
    doc.text('Información del lote', 14, 52)
    autoTable(doc, {
      startY: 56,
      head: [['Campo', 'Valor']],
      body: [
        ['Ha sembradas', lote.ha_sembradas ?? '—'],
        ['Inicio siembra', lote.fecha_inicio_siembra_real ?? '—'],
        ['Ha perdidas', lote.ha_perdidas ?? '—'],
        ['Ha cosechadas', lote.ha_cosechadas ?? '—'],
        ['Estado cultivo', lote.edo_gral_cultivo_v ?? '—'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [22, 101, 52] },
    })
  }

  if (insumos && insumos.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 100
    doc.text('Insumos aplicados', 14, finalY + 14)
    autoTable(doc, {
      startY: finalY + 18,
      head: [['Producto', 'Categoría', 'Dosis/ha', 'Ha aplicadas', 'Fecha']],
      body: insumos.map(i => [
        i.nombre_producto,
        i.categoria_producto,
        i.dosis_real_ha?.toFixed(2) ?? '—',
        i.ha_aplicadas,
        i.fecha_registro ? new Date(i.fecha_registro).toLocaleDateString('es-VE') : '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [22, 101, 52] },
    })
  }

  const pdfBytes = doc.output('arraybuffer')
  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte_${loteName.replace(/\s/g, '_')}.pdf"`,
    },
  })
}
