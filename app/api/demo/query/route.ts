import { NextResponse } from 'next/server'
import { runQuery, type QueryDescriptor } from '@/lib/demo/engine'
import { getTable } from '@/lib/demo/store'

export const dynamic = 'force-dynamic'

/**
 * Backend del cliente mock del browser (lib/demo/mock-client-browser.ts). Solo
 * existe para que los pocos componentes 'use client' que hablaban directo con
 * Supabase (UserMenu, DocumentoUploader, ...) puedan seguir haciendo
 * `.from(tabla).select().eq()` sin enterarse de que ahora hay un CSV atrás.
 * 404 fuera de DEMO_MODE: no debe quedar ningún rastro operable en producción.
 */
export async function POST(req: Request) {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const desc = (await req.json()) as QueryDescriptor
  const result = runQuery(desc, getTable(desc.table))
  return NextResponse.json(result)
}
