import type { Filter, OrderSpec, QueryDescriptor, QueryResult } from './engine'

/**
 * Encadenable + "thenable" como el query builder real de supabase-js:
 * `.from('t').select('*').eq('a', 1)` se puede `await`ar directo sin llamar
 * `.then()` a mano. Acumula el descriptor y delega la resolución real a la
 * subclase (`resolveQuery`) — directa contra el store en el servidor,
 * vía `fetch` en el browser. Ver mock-client-server.ts / mock-client-browser.ts.
 */
export abstract class BaseQueryBuilder<T = unknown> implements PromiseLike<QueryResult> {
  protected desc: QueryDescriptor

  constructor(table: string, op: QueryDescriptor['op'] = 'select', payload?: QueryDescriptor['payload']) {
    this.desc = { table, op, filters: [], orders: [], payload }
  }

  select(cols?: string): this {
    this.desc.select = cols
    return this
  }

  eq(col: string, val: unknown): this {
    this.desc.filters.push({ op: 'eq', col, val })
    return this
  }
  neq(col: string, val: unknown): this {
    this.desc.filters.push({ op: 'neq', col, val })
    return this
  }
  gt(col: string, val: unknown): this {
    this.desc.filters.push({ op: 'gt', col, val })
    return this
  }
  gte(col: string, val: unknown): this {
    this.desc.filters.push({ op: 'gte', col, val })
    return this
  }
  lt(col: string, val: unknown): this {
    this.desc.filters.push({ op: 'lt', col, val })
    return this
  }
  lte(col: string, val: unknown): this {
    this.desc.filters.push({ op: 'lte', col, val })
    return this
  }
  in(col: string, vals: unknown[]): this {
    this.desc.filters.push({ op: 'in', col, val: vals })
    return this
  }
  ilike(col: string, pattern: string): this {
    this.desc.filters.push({ op: 'ilike', col, val: pattern })
    return this
  }
  is(col: string, val: unknown): this {
    this.desc.filters.push({ op: 'is', col, val })
    return this
  }
  /** Único uso real en el proyecto: `.not(col, 'is', null)`. */
  not(col: string, op: 'is' | 'eq' | 'ilike', val: unknown): this {
    this.desc.filters.push({ op: 'not', col, inner: { op, val } })
    return this
  }
  match(criteria: Record<string, unknown>): this {
    for (const [col, val] of Object.entries(criteria)) this.desc.filters.push({ op: 'eq', col, val })
    return this
  }

  insert(payload: Record<string, unknown> | Record<string, unknown>[]): this {
    this.desc.op = 'insert'
    this.desc.payload = payload
    return this
  }
  update(payload: Record<string, unknown>): this {
    this.desc.op = 'update'
    this.desc.payload = payload
    return this
  }
  delete(): this {
    this.desc.op = 'delete'
    return this
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.desc.orders.push({ col, ascending: opts?.ascending ?? true } as OrderSpec)
    return this
  }
  limit(n: number): this {
    this.desc.limit = n
    return this
  }
  range(from: number, to: number): this {
    this.desc.range = [from, to]
    return this
  }
  single(): this {
    this.desc.single = true
    return this
  }
  maybeSingle(): this {
    this.desc.maybeSingle = true
    return this
  }

  protected abstract resolveQuery(): Promise<QueryResult>

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.resolveQuery().then(onfulfilled, onrejected)
  }
}

export type { Filter, QueryDescriptor, QueryResult }
