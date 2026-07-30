import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAgricultorScope, listAgricultores } from '@/lib/access'
import MasterAgricultorSelector from '@/components/MasterAgricultorSelector'
import MasterEmptyState from '@/components/MasterEmptyState'
import DocumentosSection from '@/components/DocumentosSection'
import AnalisisSueloUploader from '@/components/AnalisisSueloUploader'
import { resolveCiclo } from '@/lib/ciclo'
import { CATEGORIAS } from '@/lib/documentos'
import { FlaskConical, Briefcase, ScrollText } from 'lucide-react'

// Datos vivos: nunca cachear
export const dynamic = 'force-dynamic'

/** Icono por categoría — se mapea aquí para que lib/documentos.ts no dependa de React. */
const ICONOS: Record<string, React.ReactNode> = {
  analisis_suelo: <FlaskConical size={18} className="text-amber-600" />,
  convenios: <ScrollText size={18} className="text-green-700" />,
  pnl: <Briefcase size={18} className="text-violet-600" />,
}

export default async function DocumentacionPage({
  searchParams,
}: {
  searchParams: Promise<{ agricultor?: string; ciclo?: string }>
}) {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const params = await searchParams
  const scope = await resolveAgricultorScope(profile, params)
  const ciclo = resolveCiclo(params.ciclo)

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
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Documentos del ciclo {ciclo} — análisis de suelo, mapas, caso de negocio y convenios.
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

      {scope.isMaster && <AnalisisSueloUploader agricultores={agricultoresParaMaster} />}

      <div className="space-y-8">
        {CATEGORIAS.map(c => (
          <DocumentosSection
            key={c.id}
            agricultorKey={agricultorKey}
            isMaster={scope.isMaster}
            ciclo={ciclo}
            categoria={c.id}
            titulo={c.label}
            descripcion={c.descripcion}
            icono={ICONOS[c.id]}
          />
        ))}
      </div>
    </div>
  )
}
