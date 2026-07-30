import { NextResponse } from 'next/server'
import { getUserProfile } from '@/lib/auth'
import { subirAProductorHub } from '@/lib/productorhub-storage'

export const dynamic = 'force-dynamic'

/**
 * Reenvía un documento recién subido al bucket `productorhub` (proyecto
 * Supabase del equipo que hereda la plataforma). Se llama DESPUÉS de que
 * `AnalisisSueloUploader` ya guardó el archivo en `analisis-suelo` (este
 * proyecto) y su fila en `lote_analisis_suelo` — ese guardado local sigue
 * siendo la fuente de verdad mientras dure la transición; esto es un
 * best-effort de sincronización, no bloquea el flujo si falla.
 *
 * Las credenciales S3 de `productorhub` son secretas y solo viven en el
 * server (`lib/productorhub-storage.ts`); por eso el archivo pasa por acá en
 * vez de subirse directo desde el navegador.
 */
export async function POST(req: Request) {
  const profile = await getUserProfile()
  if (!profile || profile.role !== 'master') {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('file')
  const path = form.get('path')

  if (!(file instanceof File) || typeof path !== 'string' || !path) {
    return NextResponse.json({ ok: false, error: 'Falta file o path' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await subirAProductorHub(path, buffer, file.type || 'application/octet-stream')
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error subiendo a productorhub' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true })
}
