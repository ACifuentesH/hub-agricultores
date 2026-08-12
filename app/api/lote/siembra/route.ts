import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Carga manual de la fecha de siembra real de un lote.
 *
 * Contexto: agronomía aún no entrega las fechas oficiales (solo 7 de 335 lotes
 * de 2026 la tienen), así que el equipo las carga a mano para que la línea de
 * tiempo funcione.
 *
 * Seguridad: la tabla `lote` NO tiene políticas de escritura en RLS — es de
 * solo lectura para anon y authenticated, igual que el resto del esquema tras
 * el hardening. Por eso la escritura va con service_role desde aquí, y esta
 * ruta verifica ella misma que quien llama sea master. Cada cambio queda
 * registrado en `lote_eventos` para que aparezca en la campana de novedades.
 */
export async function POST(req: Request) {
  const profile = await getUserProfile()
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
  }
  if (profile.role !== 'master') {
    return NextResponse.json(
      { ok: false, error: 'Solo el equipo master puede cambiar la fecha de siembra.' },
      { status: 403 },
    )
  }

  let body: { lote_id?: string; fecha?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  }

  const loteId = body.lote_id?.trim()
  if (!loteId) {
    return NextResponse.json({ ok: false, error: 'Falta el lote' }, { status: 400 })
  }

  // '' o null limpian la fecha; si viene valor debe ser YYYY-MM-DD real
  const fechaRaw = body.fecha?.trim() ?? ''
  let fecha: string | null = null
  if (fechaRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) {
      return NextResponse.json({ ok: false, error: 'Formato de fecha inválido' }, { status: 400 })
    }
    const d = new Date(`${fechaRaw}T00:00:00Z`)
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ ok: false, error: 'Fecha inexistente' }, { status: 400 })
    }
    // Una siembra futura casi siempre es un error de tecleo
    if (d.getTime() > Date.now() + 86400000) {
      return NextResponse.json(
        { ok: false, error: 'La fecha de siembra no puede estar en el futuro.' },
        { status: 400 },
      )
    }
    fecha = fechaRaw
  }

  // Lectura con la sesión del usuario (RLS): confirma que el lote existe y es visible
  const supabase = await createClient()
  const { data: lote } = await supabase
    .from('lotes')
    .select('lote_id, nombre_lote, ciclo, fecha_siembra, agricultor_id')
    .eq('lote_id', loteId)
    .maybeSingle()

  if (!lote) {
    return NextResponse.json({ ok: false, error: 'Lote no encontrado' }, { status: 404 })
  }

  const anterior = lote.fecha_siembra ?? null
  const svc = createServiceClient()

  const { error: updErr } = await svc
    .from('lotes')
    .update({ fecha_siembra: fecha })
    .eq('lote_id', loteId)

  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })
  }

  // Bitácora: alimenta la campana de novedades con el nombre del lote
  const { error: logErr } = await svc.from('lote_eventos').insert({
    agricultor_id: lote.agricultor_id,
    lote_id: loteId,
    lote_nombre: lote.nombre_lote,
    ciclo: lote.ciclo,
    tipo: 'fecha_siembra',
    valor_anterior: anterior,
    valor_nuevo: fecha,
    usuario_id: profile.user_id ?? null,
  })

  // El registro es secundario: si falla, el cambio ya se aplicó y se avisa.
  return NextResponse.json({
    ok: true,
    lote_nombre: lote.nombre_lote,
    anterior,
    nuevo: fecha,
    aviso: logErr ? 'El cambio se guardó, pero no se pudo registrar en novedades.' : undefined,
  })
}
