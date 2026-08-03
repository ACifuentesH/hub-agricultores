import type { QueryResult } from './engine'
import { BaseQueryBuilder } from './query-builder'
import { DEMO_USER_ID, DEMO_USER_EMAIL } from './constants'

/**
 * Cliente mock para componentes 'use client' (UserMenu, DocumentoUploader,
 * DocumentoDownloadBtn, DocumentoPreviewModal — los pocos que hablan con
 * Supabase directo desde el navegador). No puede leer /demo-data (no hay
 * filesystem en el browser), así que cada query se manda por fetch al route
 * handler `/api/demo/query`, que corre el mismo motor server-side. El resto
 * de la app (Server Components, route handlers) usa el cliente directo de
 * mock-client-server.ts, sin red de por medio.
 */
class RemoteQueryBuilder<T = unknown> extends BaseQueryBuilder<T> {
  protected async resolveQuery(): Promise<QueryResult> {
    const res = await fetch('/api/demo/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.desc),
    })
    return res.json() as Promise<QueryResult>
  }
}

const DEMO_USER = { id: DEMO_USER_ID, email: DEMO_USER_EMAIL }

function hasDemoSession(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').some(c => c === 'demo_session=1')
}

const storage = {
  from(_bucket: string) {
    return {
      async createSignedUrl() {
        return {
          data: null,
          error: { message: 'Vista previa / descarga no disponible en modo demo (no hay archivos reales, solo los metadatos).' },
        }
      },
      async upload() {
        return { data: null, error: { message: 'Subida deshabilitada en modo demo.' } }
      },
    }
  },
}

export function createDemoBrowserClient() {
  return {
    from<T = unknown>(table: string) {
      return new RemoteQueryBuilder<T>(table)
    },
    async rpc(name: string, args?: Record<string, unknown>) {
      const res = await fetch('/api/demo/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, args }),
      })
      return res.json()
    },
    storage,
    auth: {
      async getUser() {
        return { data: { user: hasDemoSession() ? DEMO_USER : null }, error: null }
      },
      async getSession() {
        return { data: { session: hasDemoSession() ? { user: DEMO_USER } : null }, error: null }
      },
      // La app real re-autentica con esto para confirmar el password actual
      // antes de cambiarlo. En modo demo no hay password real: siempre "ok".
      async signInWithPassword() {
        return { data: { user: DEMO_USER, session: { user: DEMO_USER } }, error: null }
      },
      async updateUser() {
        return { data: { user: DEMO_USER }, error: null }
      },
      async signOut() {
        document.cookie = 'demo_session=; Max-Age=0; path=/'
        return { error: null }
      },
    },
  }
}
