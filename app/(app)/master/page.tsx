import { createServiceClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { resolveCiclo } from '@/lib/ciclo'
import {
  Users, CloudSun, Sprout, FolderOpen, CalendarOff,
  CircleCheck, CircleAlert, CircleX, ExternalLink,
} from 'lucide-react'

// Datos vivos: nunca cachear
export const dynamic = 'force-dynamic'

/**
 * Consola de validación del master.
 *
 * El master no administra permisos: valida que lo que ve cada usuario esté
 * completo. Por eso la tabla se arma sobre USUARIOS (quienes realmente entran
 * a la app), no sobre agropecuarias, y cada fila muestra si sus pantallas
 * tendrán datos o saldrán vacías, con acceso directo a la vista del usuario.
 *
 * Vive dentro del grupo (app) para heredar la barra fija, la cabecera y el
 * filtro de ciclo. Antes tenía un layout propio duplicado que se quedó atrás.
 */
export default async function MasterPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string }>
}) {
  await requireRole('master')
  const params = await searchParams
  const ciclo = resolveCiclo(params.ciclo)

  // Service client: la vista es master-only (requireRole arriba) y necesita
  // leer datos de todos los agricultores a la vez.
  const svc = createServiceClient()

  const [
    { data: perfiles },
    { data: agropecuarias },
    { data: lotes },
    { data: docs },
    { data: clima },
  ] = await Promise.all([
    svc.from('user_profiles').select('agricultor_key, role').neq('role', 'master'),
    svc.from('agropecuaria').select('AgricultorKey, nombre_agropecuaria, ciclo'),
    svc.from('lote').select('AgricultorKey, ha_sembradas, fecha_inicio_siembra_real, ha_perdidas, ha_cosechadas').eq('ciclo', ciclo),
    svc.from('lote_analisis_suelo').select('agricultor_key, categoria').eq('ciclo', ciclo),
    svc.from('v_clima_efectivo').select('agricultor_key, fuente, davis_key'),
  ])

  const nombrePorKey = new Map(
    (agropecuarias ?? []).map(a => [a.AgricultorKey as string, a.nombre_agropecuaria as string | null]),
  )
  const climaPorKey = new Map(
    (clima ?? []).map(c => [c.agricultor_key as string, c]),
  )

  const lotesPorKey = new Map<string, typeof lotes>()
  for (const l of lotes ?? []) {
    const k = l.AgricultorKey as string
    if (!k) continue
    const arr = lotesPorKey.get(k) ?? []
    arr!.push(l)
    lotesPorKey.set(k, arr)
  }

  const docsPorKey = new Map<string, number>()
  for (const d of docs ?? []) {
    const k = d.agricultor_key as string
    docsPorKey.set(k, (docsPorKey.get(k) ?? 0) + 1)
  }

  const filas = (perfiles ?? [])
    .map(p => {
      const key = p.agricultor_key as string
      const misLotes = lotesPorKey.get(key) ?? []
      const conSiembra = misLotes.filter(
        l => l.fecha_inicio_siembra_real != null && l.fecha_inicio_siembra_real !== '',
      ).length
      const c = climaPorKey.get(key)
      return {
        key,
        nombre: nombrePorKey.get(key) ?? key,
        existeAgro: nombrePorKey.has(key),
        fuente: (c?.fuente as string | undefined) ?? 'sin_perfil',
        estacion: (c?.davis_key as string | null) ?? null,
        lotes: misLotes.length,
        haSembradas: misLotes.reduce((s, l) => s + (parseFloat(l.ha_sembradas ?? '0') || 0), 0),
        conSiembra,
        docs: docsPorKey.get(key) ?? 0,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  // El ciclo en curso no tiene cierre: se detecta por dato, no por año fijo.
  const cicloTieneCierre = (lotes ?? []).some(
    l =>
      (l.ha_perdidas != null && l.ha_perdidas !== '') ||
      (l.ha_cosechadas != null && l.ha_cosechadas !== ''),
  )

  const conClima = filas.filter(f => f.fuente === 'davis' || f.fuente === 'triangulated').length
  const conLotes = filas.filter(f => f.lotes > 0).length
  const conDocs = filas.filter(f => f.docs > 0).length
  const sinNada = filas.filter(f => f.lotes === 0 && f.docs === 0).length

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Validación de lo que ve cada usuario en el ciclo {ciclo}. Entra a su vista con un clic.
        </p>
      </div>

      {/* Señales globales de completitud */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<Users className="text-green-600" size={22} />} label="Usuarios" value={String(filas.length)} />
        <Kpi
          icon={<CloudSun className="text-blue-500" size={22} />}
          label="Con clima"
          value={`${conClima}/${filas.length}`}
          alerta={conClima < filas.length}
        />
        <Kpi
          icon={<Sprout className="text-green-600" size={22} />}
          label={`Con lotes en ${ciclo}`}
          value={`${conLotes}/${filas.length}`}
          alerta={conLotes < filas.length}
        />
        <Kpi
          icon={<FolderOpen className="text-violet-600" size={22} />}
          label="Con documentos"
          value={`${conDocs}/${filas.length}`}
          alerta={conDocs < filas.length}
        />
      </div>

      {sinNada > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <b>{sinNada}</b> usuario{sinNada === 1 ? '' : 's'} verá{sinNada === 1 ? '' : 'n'} el ciclo {ciclo}
            prácticamente vacío: sin lotes ni documentos cargados.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">
            Usuarios y estado de sus pantallas
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-left">Clima</th>
                <th className="px-4 py-3 text-right">Lotes</th>
                <th className="px-4 py-3 text-right">Ha sembradas</th>
                <th className="px-4 py-3 text-right">Con siembra</th>
                <th className="px-4 py-3 text-right">Docs</th>
                <th className="px-4 py-3 text-right">Ver como</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filas.map(f => (
                <tr key={f.key} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800 dark:text-gray-100">{f.nombre}</span>
                    {!f.existeAgro && (
                      <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        sin perfil
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ClimaChip fuente={f.fuente} estacion={f.estacion} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{f.lotes}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                    {f.haSembradas.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {f.lotes === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : f.conSiembra === 0 ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        title="Sin fecha de siembra: la línea de tiempo del cultivo saldrá vacía"
                      >
                        <CalendarOff size={10} /> 0/{f.lotes}
                      </span>
                    ) : (
                      <span className="text-gray-600 dark:text-gray-300">
                        {f.conSiembra}/{f.lotes}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                    {f.docs > 0 ? f.docs : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <VerComo href={`/dashboard?agricultor=${encodeURIComponent(f.key)}&ciclo=${ciclo}`} label="Panel" />
                      <VerComo href={`/clima?agricultor=${encodeURIComponent(f.key)}&ciclo=${ciclo}`} label="Clima" />
                      <VerComo href={`/cultivo?agricultor=${encodeURIComponent(f.key)}&ciclo=${ciclo}`} label="Cultivo" />
                      <VerComo href={`/documentacion?agricultor=${encodeURIComponent(f.key)}&ciclo=${ciclo}`} label="Docs" />
                    </div>
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No hay usuarios agricultores registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!cicloTieneCierre && (
          <p className="border-t border-gray-100 px-5 py-3 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
            El ciclo {ciclo} está en curso: todavía no hay cosecha ni pérdidas reportadas, por eso no se muestran esas columnas.
          </p>
        )}
      </div>
    </div>
  )
}

function Kpi({
  icon, label, value, alerta,
}: {
  icon: React.ReactNode; label: string; value: string; alerta?: boolean
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="shrink-0 rounded-lg bg-gray-50 p-2 dark:bg-gray-800">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`text-xl font-bold ${alerta ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-100'}`}>
          {value}
        </p>
      </div>
    </div>
  )
}

function ClimaChip({ fuente, estacion }: { fuente: string; estacion: string | null }) {
  if (fuente === 'davis') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-800 dark:bg-green-900/40 dark:text-green-300"
        title={estacion ?? 'Estación Davis'}
      >
        <CircleCheck size={11} /> Estación
      </span>
    )
  }
  if (fuente === 'triangulated') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
        title="Estimado por triangulación entre estaciones cercanas"
      >
        <CircleCheck size={11} /> Triangulado
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-700 dark:bg-red-900/40 dark:text-red-300"
      title="Este usuario verá el módulo de clima vacío"
    >
      <CircleX size={11} /> Sin datos
    </span>
  )
}

function VerComo({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition-colors hover:border-green-500 hover:text-green-700 dark:border-gray-700 dark:text-gray-300 dark:hover:text-green-400"
    >
      {label}
      <ExternalLink size={9} />
    </Link>
  )
}
