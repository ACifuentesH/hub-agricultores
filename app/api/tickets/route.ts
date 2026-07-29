import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const CATEGORIAS = ['general', 'clima', 'cultivo', 'documentos', 'datos_incorrectos']

/** Tickets visibles para quien consulta (RLS decide el alcance). */
export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tickets')
    .select('id, asunto, mensaje, categoria, estado, respuesta, respondido_at, created_at, agricultor_key')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, tickets: data ?? [] })
}

/** Crea un ticket. El agricultor_key se toma del perfil, nunca del cliente. */
export async function POST(req: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
  if (!profile.agricultor_key) {
    return NextResponse.json(
      { ok: false, error: 'Tu usuario no tiene un agricultor asignado.' },
      { status: 400 },
    )
  }

  let body: { asunto?: string; mensaje?: string; categoria?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  }

  const asunto = (body.asunto ?? '').trim()
  const mensaje = (body.mensaje ?? '').trim()
  const categoria = CATEGORIAS.includes(body.categoria ?? '') ? body.categoria! : 'general'

  if (asunto.length < 3) {
    return NextResponse.json({ ok: false, error: 'Escribe un asunto.' }, { status: 400 })
  }
  if (mensaje.length < 5) {
    return NextResponse.json({ ok: false, error: 'Cuéntanos un poco más en el mensaje.' }, { status: 400 })
  }
  if (asunto.length > 140 || mensaje.length > 4000) {
    return NextResponse.json({ ok: false, error: 'El texto es demasiado largo.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      agricultor_key: profile.agricultor_key,
      usuario_id: profile.user_id,
      asunto,
      mensaje,
      categoria,
    })
    .select('id, asunto, categoria, estado, created_at')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ticket: data })
}
