import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { CATEGORIAS, ACEPTADOS_MIME, MAX_BYTES, type CategoriaId } from '@/lib/documentos'
import { subirAProductorHub } from '@/lib/productorhub-storage'

export const dynamic = 'force-dynamic'

/**
 * Carga de un documento (análisis de suelo, mapa, caso de negocio o convenio)
 * para un agricultor. Reemplaza el insert directo desde el browser que hacía
 * `AnalisisSueloUploader`: la tabla `lote_analisis_suelo` y el bucket
 * `analisis-suelo` ahora son solo-lectura en RLS para master, así que la
 * escritura vive acá con `service_role`, igual que `app/api/lote/siembra`.
 *
 * Un archivo por request — el uploader cliente sigue subiendo con
 * concurrencia limitada, cada subida es su propio POST.
 */
export async function POST(req: Request) {
  const profile = await getUserProfile()
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
  }
  if (profile.role !== 'master') {
    return NextResponse.json(
      { ok: false, error: 'Solo el equipo master puede cargar documentos.' },
      { status: 403 },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Falta el archivo' }, { status: 400 })
  }

  const agricultorKey = String(form.get('agricultor_key') ?? '').trim()
  const ciclo = String(form.get('ciclo') ?? '').trim()
  const categoriaRaw = String(form.get('categoria') ?? '').trim()
  const loteId = String(form.get('lote_id') ?? '').trim() || null

  if (!agricultorKey) {
    return NextResponse.json({ ok: false, error: 'Falta el agricultor' }, { status: 400 })
  }
  // Nunca inferir/normalizar en escritura: a diferencia de resolveCategoria()
  // (que hace fallback silencioso para lectura), acá un valor inválido debe
  // rechazarse — un fallback silencioso archivaría mal el documento.
  if (!CATEGORIAS.some(c => c.id === categoriaRaw)) {
    return NextResponse.json({ ok: false, error: 'Categoría inválida' }, { status: 400 })
  }
  const categoria = categoriaRaw as CategoriaId
  // El ciclo nunca se infiere ni se acepta compuesto (p.ej. "2025,2026").
  if (!/^\d{4}$/.test(ciclo)) {
    return NextResponse.json({ ok: false, error: 'Ciclo inválido' }, { status: 400 })
  }
  if (!ACEPTADOS_MIME.includes(file.type as (typeof ACEPTADOS_MIME)[number])) {
    return NextResponse.json({ ok: false, error: `Tipo de archivo no permitido: ${file.type}` }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'El archivo supera el tamaño máximo permitido (20MB)' }, { status: 400 })
  }

  // Verificación con el cliente RLS del usuario: confirma que el agricultor
  // (y el lote, si viene) existen y son visibles para este master.
  const supabase = await createClient()
  const { data: agricultor } = await supabase
    .from('agropecuaria')
    .select('AgricultorKey')
    .eq('AgricultorKey', agricultorKey)
    .maybeSingle()
  if (!agricultor) {
    return NextResponse.json({ ok: false, error: 'Agricultor no encontrado' }, { status: 404 })
  }
  if (loteId) {
    const { data: lote } = await supabase
      .from('lote')
      .select('lote_id')
      .eq('lote_id', loteId)
      .eq('AgricultorKey', agricultorKey)
      .eq('ciclo', ciclo)
      .maybeSingle()
    if (!lote) {
      return NextResponse.json({ ok: false, error: 'Lote no encontrado para ese agricultor/ciclo' }, { status: 404 })
    }
  }

  const svc = createServiceClient()

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
  const path = `${agricultorKey}/${ciclo}/${categoria}/${Date.now()}_${safe}`

  const { error: upErr } = await svc.storage
    .from('analisis-suelo')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })
  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
  }

  const { data: inserted, error: insErr } = await svc
    .from('lote_analisis_suelo')
    .insert({
      agricultor_key: agricultorKey,
      ciclo,
      categoria,
      lote_id: loteId,
      storage_path: path,
      nombre_archivo: file.name,
      tamano_bytes: file.size,
      es_vigente: true,
      uploaded_by: profile.user_id,
    })
    .select('id')
    .single()

  if (insErr) {
    // rollback: borrar el archivo subido
    await svc.storage.from('analisis-suelo').remove([path])
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
  }

  // Reenvío best-effort al bucket `productorhub` (proyecto Supabase del
  // equipo que hereda la plataforma): el guardado de arriba ya es la fuente
  // de verdad durante la transición, así que un fallo acá solo se informa,
  // nunca revierte el upload. Mismo `path` que en `analisis-suelo`.
  let syncWarning: string | undefined
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await subirAProductorHub(path, buffer, file.type || 'application/octet-stream')
  } catch (err) {
    syncWarning = err instanceof Error ? err.message : 'No se pudo sincronizar con productorhub'
  }

  return NextResponse.json({ ok: true, id: inserted.id, sync_warning: syncWarning })
}
