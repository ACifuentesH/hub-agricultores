import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Borra un documento (solo master). Reemplaza el borrado en dos pasos que
 * hacía `AnalisisSueloDeleteBtn` directo desde el browser: la tabla y el
 * bucket ahora son solo-lectura en RLS para master, así que la escritura
 * vive acá con `service_role`.
 *
 * A diferencia del botón anterior, el `storage_path` se resuelve acá por id
 * en vez de confiar en lo que mande el cliente.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
  }
  if (profile.role !== 'master') {
    return NextResponse.json(
      { ok: false, error: 'Solo el equipo master puede eliminar documentos.' },
      { status: 403 },
    )
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Falta el id' }, { status: 400 })
  }

  // Lectura con la sesión del usuario (RLS): confirma que el documento existe
  // y es visible, y resuelve el storage_path real (nunca el que mande el cliente).
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from('lote_analisis_suelo')
    .select('id, storage_path, nombre_archivo')
    .eq('id', id)
    .maybeSingle()

  if (!doc) {
    return NextResponse.json({ ok: false, error: 'Documento no encontrado' }, { status: 404 })
  }

  const svc = createServiceClient()

  const { error: storageErr } = await svc.storage.from('analisis-suelo').remove([doc.storage_path])
  if (storageErr) {
    const msg = storageErr.message?.toLowerCase() ?? ''
    const isMissing = msg.includes('not found') || msg.includes('does not exist') || msg.includes('object not found')
    if (!isMissing) {
      return NextResponse.json({ ok: false, error: `No se pudo borrar del Storage: ${storageErr.message}` }, { status: 500 })
    }
  }

  // Borrado siempre acotado por id (primary key) — cumple la regla de no
  // borrar sin WHERE explícito.
  const { error: delErr } = await svc.from('lote_analisis_suelo').delete().eq('id', id)
  if (delErr) {
    return NextResponse.json({ ok: false, error: `Storage borrado pero el registro falló: ${delErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, nombre_archivo: doc.nombre_archivo })
}
