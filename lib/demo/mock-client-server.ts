import { runQuery, type QueryResult } from './engine'
import { getTable } from './store'
import { DEMO_USER_ID, DEMO_USER_EMAIL } from './constants'
import { BaseQueryBuilder } from './query-builder'
import { rpcResult } from './rpc'

class DirectQueryBuilder<T = unknown> extends BaseQueryBuilder<T> {
  protected async resolveQuery(): Promise<QueryResult> {
    return runQuery(this.desc, getTable(this.desc.table))
  }
}

const DEMO_USER = { id: DEMO_USER_ID, email: DEMO_USER_EMAIL }

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

/**
 * Cliente mock server-side: mismo shape que el real (`.from/.rpc/.auth/.storage`),
 * usado por `createClient()` y `createServiceClient()` en lib/supabase/server.ts
 * cuando DEMO_MODE=true. `hasSession` ya viene resuelto (leído de la cookie
 * `demo_session` por el caller) porque `cookies()` de next/headers solo puede
 * leerse ahí, no dentro de este módulo compartido con el browser.
 */
export function createDemoServerClient(hasSession: boolean) {
  return {
    from<T = unknown>(table: string) {
      return new DirectQueryBuilder<T>(table)
    },
    async rpc(name: string, args?: Record<string, unknown>) {
      return rpcResult(name, args)
    },
    storage,
    auth: {
      async getUser() {
        return { data: { user: hasSession ? DEMO_USER : null }, error: null }
      },
      async getSession() {
        return { data: { session: hasSession ? { user: DEMO_USER } : null }, error: null }
      },
      async signInWithPassword() {
        return { data: { user: DEMO_USER, session: { user: DEMO_USER } }, error: null }
      },
      async updateUser() {
        return { data: { user: DEMO_USER }, error: null }
      },
      async signOut() {
        return { error: null }
      },
    },
  }
}
