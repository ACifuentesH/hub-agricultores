import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { pdfEstadoResultados, excelEstadoResultados, type FilaPL } from '@/lib/reportes-pl'

export const dynamic = 'force-dynamic'

/**
 * Estado de resultados (P&L) del agricultor, **por finca**.
 *
 * Los datos vienen de `pl_unidad`, que se rellena desde el espejo de Saturno en
 * cada sincronización: una fila por unidad de producción (la finca), con los
 * costos ya totalizados a ese nivel — no hay desglose por lote. Se consulta con
 * el cliente RLS del usuario: un agricultor solo obtiene sus propias fincas; el
 * master puede pedir las de otro con ?agricultor=KEY.
 *
 * Formato: PDF por defecto. El Excel (?formato=xlsx) queda reservado al master,
 * que lo usa para analizar; al agricultor se le entrega un documento cerrado,
 * legible en el teléfono y sin riesgo de que una hoja editable circule como si
 * fuera la fuente de la verdad.
 */
export async function GET(req: Request) {
  const profile = await getUserProfile()
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const pedido = url.searchParams.get('agricultor')?.trim() || null
  // Un farmer nunca puede pedir el P&L de otro: se ignora el parámetro.
  const esMaster = profile.role === 'master'
  const agricultorKey = esMaster ? (pedido ?? profile.agricultor_id) : profile.agricultor_id
  if (!agricultorKey) {
    return NextResponse.json({ ok: false, error: 'Falta el agricultor' }, { status: 400 })
  }

  const formato = url.searchParams.get('formato') === 'xlsx' ? 'xlsx' : 'pdf'
  if (formato === 'xlsx' && !esMaster) {
    return NextResponse.json(
      { ok: false, error: 'El estado de resultados se descarga en PDF.' },
      { status: 403 },
    )
  }

  const supabase = await createClient()
  const [{ data: filas }, { data: agro }] = await Promise.all([
    supabase
      .from('pl_unidad')
      .select('*')
      .eq('agricultor_key', agricultorKey)
      .order('nombre_up'),
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

  const meta = {
    nombre: agro?.nombre_agropecuaria ?? agricultorKey,
    ciclo: filas[0].ciclo as string,
  }
  const archivo =
    `Estado_de_resultados_${meta.nombre.replace(/[^a-zA-Z0-9]/g, '_')}_${meta.ciclo}.${formato}`

  if (formato === 'xlsx') {
    const buf = await excelEstadoResultados(filas as FilaPL[], meta)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${archivo}"`,
      },
    })
  }

  const bytes = await pdfEstadoResultados(filas as FilaPL[], meta)
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${archivo}"`,
    },
  })
}
