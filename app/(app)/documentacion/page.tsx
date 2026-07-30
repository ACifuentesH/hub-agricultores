import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAgricultorScope, listAgricultores } from '@/lib/access'
import MasterAgricultorSelector from '@/components/MasterAgricultorSelector'
import MasterEmptyState from '@/components/MasterEmptyState'
import DocumentosSection from '@/components/DocumentosSection'
import DocumentoUploader from '@/components/DocumentoUploader'
import DocumentoCategoriaTabs from '@/components/DocumentoCategoriaTabs'
import DescargarPLBtn from '@/components/DescargarPLBtn'
import { resolveCiclo } from '@/lib/ciclo'
import { CATEGORIAS, resolveCategoria } from '@/lib/documentos'

// Datos vivos: nunca cachear
export const dynamic = 'force-dynamic'

export default async function DocumentacionPage({
  searchParams,
}: {
  searchParams: Promise<{ agricultor?: string; ciclo?: string; categoria?: string }>
}) {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const params = await searchParams
  const scope = await resolveAgricultorScope(profile, params)
  const ciclo = resolveCiclo(params.ciclo)
  const categoria = resolveCategoria(params.categoria)
  const categoriaActual = CATEGORIAS.find(c => c.id === categoria)!

  if (scope.isMaster && !scope.agricultorKey) {
    const agricultores = await listAgricultores()
    return (
      <MasterEmptyState
        title="Documentación"
        subtitle="Vista master — selecciona un agricultor para ver y cargar sus documentos."
        agricultores={agricultores}
        selected={null}
      />
    )
  }

  const agricultorKey = scope.agricultorKey ?? ''

  // Lista global de agricultores para el dropdown del uploader (solo master)
  let agricultoresParaMaster: { AgricultorKey: string; nombre_agropecuaria: string; ciclo: string | null }[] = []
  let agricultores: { key: string; nombre: string }[] = []
  if (scope.isMaster) {
    const svc = createServiceClient()
    const [{ data }, lista] = await Promise.all([
      svc.from('agropecuaria').select('AgricultorKey, nombre_agropecuaria, ciclo').order('nombre_agropecuaria'),
      listAgricultores(),
    ])
    agricultoresParaMaster = data ?? []
    agricultores = lista
  }

  return (
    <div className="relative space-y-6">
      {/* Wash decorativo, sutil, para que el glassmorphism de abajo tenga algo
          de color para refractar — sin esto el blur solo se ve gris plano. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/4 -z-10 h-72 w-72 rounded-full bg-green-400/20 blur-3xl dark:bg-green-500/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 right-0 -z-10 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-400/10"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Documentos del ciclo {ciclo}.
            {scope.isMaster && scope.agropecuariaName && (
              <span className="ml-2 font-medium text-green-700 dark:text-green-400">
                · {scope.agropecuariaName}
              </span>
            )}
          </p>
        </div>
        {scope.isMaster && (
          <MasterAgricultorSelector agricultores={agricultores} selected={scope.agricultorKey} />
        )}
      </div>

      {scope.isMaster && <DocumentoUploader agricultores={agricultoresParaMaster} />}

      <DocumentoCategoriaTabs categorias={CATEGORIAS} activa={categoria} />

      <DocumentosSection
        agricultorKey={agricultorKey}
        isMaster={scope.isMaster}
        ciclo={ciclo}
        categoria={categoria}
        descripcion={categoriaActual.descripcion}
      />

      {/* Extra: no es un documento cargado por nadie, se genera al vuelo desde
          los costos de Saturno. Va fuera de las pestañas —y separado por una
          línea— para que no se lea como una cuarta categoría del archivo. */}
      <div className="border-t border-gray-200 pt-6 dark:border-gray-800">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                Estado de resultados (P&amp;L)
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Costos por unidad de producción: semillas, agroquímicos, fertilizantes,
                mecanización, servicio técnico y financiamiento. En Excel, con resumen y detalle.
              </p>
            </div>
            <DescargarPLBtn agricultorKey={scope.isMaster ? scope.agricultorKey : null} />
          </div>
        </div>
      </div>
    </div>
  )
}
