/**
 * Motor de queries en memoria que imita el subconjunto de la API de
 * supabase-js que usa este proyecto (`.select/.eq/.in/.order/.limit/.range/
 * .single/.maybeSingle/.insert/.update/.delete`). Puro: no toca el
 * filesystem ni cookies — recibe el array de la tabla ya cargado y devuelve
 * `{ data, error }` con la misma forma que el cliente real.
 *
 * Usado tanto por el cliente mock "directo" (Server Components / route
 * handlers, ver mock-client-server.ts) como por el route handler
 * `/api/demo/query` que expone el mismo motor a los componentes cliente que
 * antes hablaban directo con Supabase (ver mock-client-browser.ts).
 */

export type CompareOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'

export interface Filter {
  op: CompareOp | 'in' | 'is' | 'ilike' | 'not'
  col: string
  val?: unknown
  /** Solo para op:'not' — el filtro que se está negando. */
  inner?: { op: CompareOp | 'is' | 'ilike'; val: unknown }
}

export interface OrderSpec {
  col: string
  ascending: boolean
}

export interface QueryDescriptor {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  select?: string
  filters: Filter[]
  orders: OrderSpec[]
  limit?: number
  range?: [number, number]
  single?: boolean
  maybeSingle?: boolean
  payload?: Record<string, unknown> | Record<string, unknown>[]
}

export interface QueryResult {
  data: unknown
  error: { message: string } | null
}

type Row = Record<string, unknown>

/** Compara valores heterogéneos (número real, número-como-texto, fecha ISO, texto). */
function toComparable(v: unknown): number | string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  const s = String(v)
  if (s === '') return null
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  const t = Date.parse(s)
  if (!Number.isNaN(t) && /\d{4}-\d{2}-\d{2}/.test(s)) return t
  return s
}

function matchesOne(row: Row, op: CompareOp | 'is' | 'ilike', col: string, val: unknown): boolean {
  const rowVal = row[col]
  switch (op) {
    case 'eq':
      return String(rowVal) === String(val)
    case 'neq':
      return String(rowVal) !== String(val)
    case 'is':
      return val === null ? rowVal === null || rowVal === undefined : rowVal === val
    case 'ilike': {
      const pattern = String(val)
        .toLowerCase()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.')
      return new RegExp(`^${pattern}$`).test(String(rowVal ?? '').toLowerCase())
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = toComparable(rowVal)
      const b = toComparable(val)
      if (a === null || b === null) return false
      if (op === 'gt') return a > b
      if (op === 'gte') return a >= b
      if (op === 'lt') return a < b
      return a <= b
    }
  }
}

function matchesFilter(row: Row, f: Filter): boolean {
  if (f.op === 'in') {
    const arr = Array.isArray(f.val) ? f.val : []
    return arr.some(v => String(v) === String(row[f.col]))
  }
  if (f.op === 'not') {
    return !matchesOne(row, f.inner!.op, f.col, f.inner!.val)
  }
  return matchesOne(row, f.op, f.col, f.val)
}

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return rows.filter(r => filters.every(f => matchesFilter(r, f)))
}

function applyOrder(rows: Row[], orders: OrderSpec[]): Row[] {
  if (orders.length === 0) return rows
  return [...rows].sort((a, b) => {
    for (const o of orders) {
      const av = toComparable(a[o.col])
      const bv = toComparable(b[o.col])
      if (av === bv) continue
      if (av === null) return o.ascending ? -1 : 1
      if (bv === null) return o.ascending ? 1 : -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      if (cmp !== 0) return o.ascending ? cmp : -cmp
    }
    return 0
  })
}

/** Proyecta columnas; despoja comillas dobles ("AgricultorKey" → AgricultorKey) como hace PostgREST. */
function project(row: Row, cols?: string): Row {
  if (!cols || cols.trim() === '' || cols.trim() === '*') return { ...row }
  const names = cols.split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1')).filter(Boolean)
  const out: Row = {}
  for (const n of names) out[n] = row[n]
  return out
}

function singleResult(rows: Row[], single?: boolean, maybeSingle?: boolean): unknown {
  if (single) {
    if (rows.length !== 1) return undefined // el caller decide el error
    return rows[0]
  }
  if (maybeSingle) return rows[0] ?? null
  return rows
}

/**
 * `table` es el array VIVO en memoria (misma referencia que guarda el store):
 * insert/update/delete lo mutan directamente para que los cambios persistan
 * durante la sesión del servidor de desarrollo.
 */
export function runQuery(desc: QueryDescriptor, table: Row[]): QueryResult {
  try {
    if (desc.op === 'insert') {
      const payloads = Array.isArray(desc.payload) ? desc.payload : desc.payload ? [desc.payload] : []
      const inserted: Row[] = payloads.map(p => {
        const row: Row = { ...p }
        if (row.id === undefined) row.id = cryptoRandomId()
        if (row.created_at === undefined && 'created_at' in (table[0] ?? { created_at: undefined })) {
          row.created_at = new Date().toISOString()
        }
        if (row.estado === undefined && 'estado' in (table[0] ?? { estado: undefined })) {
          row.estado = 'abierto'
        }
        table.push(row)
        return row
      })
      const projected = inserted.map(r => project(r, desc.select))
      const data = singleResult(projected, desc.single, desc.maybeSingle)
      if (desc.single && data === undefined) {
        return { data: null, error: { message: 'No se pudo confirmar el insert (modo demo).' } }
      }
      return { data, error: null }
    }

    if (desc.op === 'update') {
      const matches = applyFilters(table, desc.filters)
      for (const row of matches) Object.assign(row, desc.payload as Row)
      const projected = matches.map(r => project(r, desc.select))
      const data = singleResult(projected, desc.single, desc.maybeSingle)
      return { data: data ?? projected, error: null }
    }

    if (desc.op === 'delete') {
      const matches = applyFilters(table, desc.filters)
      for (const row of matches) {
        const idx = table.indexOf(row)
        if (idx >= 0) table.splice(idx, 1)
      }
      const projected = matches.map(r => project(r, desc.select))
      return { data: projected, error: null }
    }

    // select
    let rows = applyFilters(table, desc.filters)
    rows = applyOrder(rows, desc.orders)
    if (desc.range) rows = rows.slice(desc.range[0], desc.range[1] + 1)
    else if (desc.limit != null) rows = rows.slice(0, desc.limit)
    const projected = rows.map(r => project(r, desc.select))
    const data = singleResult(projected, desc.single, desc.maybeSingle)
    if (desc.single && data === undefined) {
      return {
        data: null,
        error: { message: `JSON object requested, ${projected.length} rows returned (modo demo)` },
      }
    }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : 'Error en modo demo' } }
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
