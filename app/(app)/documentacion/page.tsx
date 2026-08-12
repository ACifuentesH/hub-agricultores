import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveAgricultorScope, listAgricultores } from '@/lib/access'
import MasterAgricultorSelector from '@/components/MasterAgricultorSelector'
import MasterEmptyState from '@/components/MasterEmptyState'
import DocumentosSection from '@/components/DocumentosSection'
import DocumentoUploader from '@/components/DocumentoUploader'
import DocumentoCategoriaTabs from '@/components/DocumentoCategoriaTabs'
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

  // Lista global de agricultores para el dropdown del uploader (solo master).
  // Un solo listAgricultores(): el uploader y el selector lateral usan la
  // misma forma {key, nombre} — ya no hay perfiles duplicados por ciclo.
  const agricultores = scope.isMaster ? await listAgricultores() : []

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

      {scope.isMaster && <DocumentoUploader agricultores={agricultores} />}

      <DocumentoCategoriaTabs categorias={CATEGORIAS} activa={categoria} />

      <DocumentosSection
        agricultorKey={agricultorKey}
        isMaster={scope.isMaster}
        ciclo={ciclo}
        categoria={categoria}
        descripcion={categoriaActual.descripcion}
      />
    </div>
  )
}
