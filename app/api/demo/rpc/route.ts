import { NextResponse } from 'next/server'
import { rpcResult } from '@/lib/demo/rpc'

export const dynamic = 'force-dynamic'

/** Backend del `.rpc()` del cliente mock del browser. Ver lib/demo/rpc.ts. */
export async function POST(req: Request) {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const { name, args } = (await req.json()) as { name: string; args?: Record<string, unknown> }
  const result = await rpcResult(name, args)
  return NextResponse.json(result)
}
