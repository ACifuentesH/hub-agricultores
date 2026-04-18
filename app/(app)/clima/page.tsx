import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ClimaDashboard from '@/components/charts/ClimaDashboard'
import { resolveAgricultorScope, listAgricultores } from '@/lib/access'
import MasterAgricultorSelector from '@/components/MasterAgricultorSelector'
import MasterEmptyState from '@/components/MasterEmptyState'

export default async function ClimaPage({
  searchParams,
}: {
  searchParams: Promise<{ agricultor?: string }>
}) {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const params = await searchParams
  const scope = await resolveAgricultorScope(profile, params)

  if (scope.isMaster && !scope.agricultorKey) {
    const agricultores = await listAgricultores()
    return (
      <MasterEmptyState
        title="Clima"
        subtitle="Vista master — selecciona un agricultor para ver su estación y pronóstico."
        agricultores={agricultores}
        selected={null}
      />
    )
  }

  const agricultorKey = scope.agricultorKey ?? ''
  const supabase = await createClient()

  const [{ data: climaMap }, agricultores] = await Promise.all([
    supabase
      .from('mapa_productor_clima')
      .select('productor_clima')
      .eq('agricultor_key', agricultorKey)
      .maybeSingle(),
    scope.isMaster ? listAgricultores() : Promise.resolve([]),
  ])

  const productorClima = climaMap?.productor_clima ?? null

  // Últimos 30 días de lecturas diarias (agrupado)
  const { data: lecturas } = productorClima
    ? await supabase
        .from('clima_lecturas')
        .select('fecha_hora, temp_c, temp_max_c, temp_min_c, hum_pct, lluvia_mm')
        .eq('productor', productorClima)
        .order('fecha_hora', { ascending: false })
        .limit(720) // ~30 días de lecturas horarias
    : { data: [] }

  // Pronóstico 7 días
  const { data: forecast } = productorClima
    ? await supabase
        .from('clima_forecast')
        .select('fecha, temp_max_c, temp_min_c, lluvia_mm, prob_lluvia_pct, hum_avg_pct')
        .eq('productor_clima', productorClima)
        .order('fecha', { ascending: true })
        .limit(7)
    : { data: [] }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Clima</h1>
          {scope.isMaster && scope.agropecuariaName && (
            <p className="text-sm text-green-700 dark:text-green-400 font-medium mt-1">
              {scope.agropecuariaName}
            </p>
          )}
        </div>
        {scope.isMaster && (
          <MasterAgricultorSelector agricultores={agricultores} selected={scope.agricultorKey} />
        )}
      </div>
      {productorClima ? (
        <ClimaDashboard lecturas={lecturas ?? []} forecast={forecast ?? []} />
      ) : (
        <p className="text-gray-500 dark:text-gray-400">No hay datos de clima disponibles para esta ubicación.</p>
      )}
    </div>
  )
}
