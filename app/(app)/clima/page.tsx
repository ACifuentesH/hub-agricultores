import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ClimaDashboard from '@/components/charts/ClimaDashboard'

export default async function ClimaPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  const { data: climaMap } = await supabase
    .from('mapa_productor_clima')
    .select('productor_clima')
    .eq('agricultor_key', profile.agricultor_key ?? '')
    .single()

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
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Clima</h1>
      {productorClima ? (
        <ClimaDashboard lecturas={lecturas ?? []} forecast={forecast ?? []} />
      ) : (
        <p className="text-gray-500 dark:text-gray-400">No hay datos de clima disponibles para tu ubicación.</p>
      )}
    </div>
  )
}
