import { NextResponse } from 'next/server'
import { getUserProfile } from '@/lib/auth'
import { responder } from '@/lib/asistente'
import { resolveCiclo } from '@/lib/ciclo'

export const dynamic = 'force-dynamic'

/**
 * Asistente propio. Sustituye a la edge function `agri-asistente` (Gemini),
 * que no podía funcionar sin la API key que no se va a subir.
 *
 * Seguridad: el agricultor_key NO se toma del cliente para los farmers — se
 * fuerza el del perfil autenticado. Solo el master puede consultar a otro
 * agricultor. Además, todas las consultas de datos pasan por RLS.
 */
export async function POST(req: Request) {
  const profile = await getUserProfile()
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
  }

  let body: { pregunta?: string; agricultor_key?: string | null; ciclo?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  }

  const pregunta = (body.pregunta ?? '').trim()
  if (!pregunta) {
    return NextResponse.json({ ok: false, error: 'Falta la pregunta' }, { status: 400 })
  }

  const esMaster = profile.role === 'master'
  const agricultorKey = esMaster
    ? (body.agricultor_key?.trim() || null)
    : profile.agricultor_key

  const ciclo = resolveCiclo(body.ciclo)

  try {
    const r = await responder(pregunta, agricultorKey, ciclo)
    return NextResponse.json({ ok: true, respuesta: r.texto, intencion: r.intencion })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
