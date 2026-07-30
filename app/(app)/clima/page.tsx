import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveAgricultorScope } from '@/lib/access'
import MasterAgricultorSelector from '@/components/MasterAgricultorSelector'
import DataSourceBadge from '@/components/DataSourceBadge'
import DescargarHistoricoClimaBtn from '@/components/DescargarHistoricoClimaBtn'
import { getCurrentConditions, getClimateSeries, listAgricultores2026 } from '@/lib/clima'
import CurrentConditionsCard from '@/components/clima/CurrentConditionsCard'
import {
  resolveAgricultorLluviaId,
  getLotesDeAgricultor,
  getLluviaDiariaPorLotes,
  getLluviaMensualPorLotes,
  getPrediccionPorLotes,
  getLluviaMensualZona,
  getPrediccionZona,
  getLluviaDiariaEstacionPorZona,
  getTodosLosLotesGlobal,
  getDistribucionNormalLluvia,
  type LluviaDiariaLoteRow,
} from '@/lib/seguimiento-lluvia'
import StatCardRow from '@/components/clima/StatCardRow'
import LotesRainGrid from '@/components/clima/LotesRainGrid'
import TemperatureChart from '@/components/clima/TemperatureChart'
import AgricultorRainMonthlyChart from '@/components/clima/AgricultorRainMonthlyChart'
import ClimaVistaTabs from '@/components/clima/master/ClimaVistaTabs'
import GlobalAgricultoresTable from '@/components/clima/master/GlobalAgricultoresTable'
import PorAgricultorAccordion from '@/components/clima/master/PorAgricultorAccordion'
import RendimientoPorFincaAccordion from '@/components/clima/master/RendimientoPorFincaAccordion'
import ZonasComparisonSection from '@/components/clima/master/ZonasComparisonSection'
import DistribucionProbabilidadChart from '@/components/clima/master/DistribucionProbabilidadChart'

// Datos vivos: nunca cachear
export const dynamic = 'force-dynamic'

const VISTAS_MASTER = ['mi-agricultor', 'por-agricultor', 'global', 'rendimiento', 'zonas'] as const
type Vista = (typeof VISTAS_MASTER)[number]

/** A diferencia de `resolveCategoria` (lib/documentos.ts), acá el default depende de si ya hay agricultor elegido. */
function resolveVista(raw: string | undefined, tieneAgricultor: boolean): Vista {
  if ((VISTAS_MASTER as readonly string[]).includes(raw ?? '')) return raw as Vista
  return tieneAgricultor ? 'mi-agricultor' : 'global'
}

export default async function ClimaPage({
  searchParams,
}: {
  searchParams: Promise<{ agricultor?: string; vista?: string }>
}) {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const params = await searchParams
  const scope = await resolveAgricultorScope(profile, params)

  if (!scope.isMaster) {
    // Agricultor: siempre su propia vista, sin pestañas ni selector.
    return (
      <div className="space-y-6">
        <MiAgricultorContent agricultorKey={scope.agricultorKey ?? ''} isMaster={false} />
      </div>
    )
  }

  // Master: ya no se corta a un empty-state de página completa antes de
  // mostrar nada — aterriza directo en el dashboard espejado (mismo
  // comportamiento que tenía seguimiento-lluvia-saturno).
  const agricultores = await listAgricultores2026()
  const vista = resolveVista(params.vista, !!scope.agricultorKey)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {vista === 'mi-agricultor' && scope.agropecuariaName && (
            <p className="text-sm font-medium text-green-700 dark:text-green-400">{scope.agropecuariaName}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ClimaVistaTabs vistaActual={vista} />
          {vista === 'mi-agricultor' && (
            <MasterAgricultorSelector agricultores={agricultores} selected={scope.agricultorKey} />
          )}
        </div>
      </div>

      {vista === 'mi-agricultor' && (
        scope.agricultorKey ? (
          <MiAgricultorContent agricultorKey={scope.agricultorKey} isMaster />
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
            Selecciona un agricultor arriba para ver su seguimiento de lluvia.
          </div>
        )
      )}

      {vista === 'por-agricultor' && <PorAgricultorAccordion lotes={await getTodosLosLotesGlobal()} />}
      {vista === 'global' && <GlobalAgricultoresTable lotes={await getTodosLosLotesGlobal()} />}
      {vista === 'rendimiento' && <RendimientoPorFincaAccordion lotes={await getTodosLosLotesGlobal()} />}
      {vista === 'zonas' && <ZonasVistaContent />}
    </div>
  )
}

/**
 * Vista de UN agricultor: el mensual de lluvia (real/pronóstico) va primero
 * — es el gráfico principal de todo el módulo — seguido de la lectura
 * actual, KPIs, gráficos por lote y temperatura. Ya no muestra el gráfico de
 * su zona (Oriente/Occidente): eso quedó solo en la pestaña "Zonas" de
 * master. La usan tanto el agricultor logueado como el master cuando elige
 * `?agricultor=` en la pestaña "Mi agricultor".
 */
async function MiAgricultorContent({ agricultorKey, isMaster }: { agricultorKey: string; isMaster: boolean }) {
  const [conditions, agricultorLluviaId, climateSeries] = await Promise.all([
    getCurrentConditions(agricultorKey),
    resolveAgricultorLluviaId(agricultorKey),
    getClimateSeries(agricultorKey, 30),
  ])

  const lotes = agricultorLluviaId ? await getLotesDeAgricultor(agricultorLluviaId) : []
  const loteIds = lotes.map(l => l.id)

  const [dailyRows, mensualRows, prediccionRows] = await Promise.all([
    getLluviaDiariaPorLotes(loteIds),
    getLluviaMensualPorLotes(loteIds),
    getPrediccionPorLotes(loteIds),
  ])

  const dailyByLote = new Map<string, LluviaDiariaLoteRow[]>()
  for (const row of dailyRows) {
    const arr = dailyByLote.get(row.lote_id) ?? []
    arr.push(row)
    dailyByLote.set(row.lote_id, arr)
  }

  return (
    <div className="space-y-6">
      <AgricultorRainMonthlyChart mensual={mensualRows} prediccion={prediccionRows} />

      <div className="flex flex-wrap items-center gap-2">
        <DataSourceBadge source={conditions.source} fecha={conditions.fecha} size="sm" />
        {conditions.source.fuente === 'davis' && (
          <DescargarHistoricoClimaBtn
            agricultorKey={isMaster ? agricultorKey : null}
            agricultorNombre={null}
            size="sm"
          />
        )}
      </div>

      <CurrentConditionsCard conditions={conditions} />
      <StatCardRow lotes={lotes} />
      <LotesRainGrid lotes={lotes} dailyByLote={dailyByLote} />
      <TemperatureChart series={climateSeries} />
    </div>
  )
}

/** Vista "Zonas" (solo master): comparación Oriente/Occidente + distribución de probabilidad global. */
async function ZonasVistaContent() {
  const ZONAS = ['Oriente', 'Occidente']
  const [zonas, distribucion] = await Promise.all([
    Promise.all(
      ZONAS.map(async zona => ({
        zona,
        mensual: await getLluviaMensualZona(zona),
        prediccion: await getPrediccionZona(zona),
        diaria: await getLluviaDiariaEstacionPorZona(zona),
      })),
    ),
    getDistribucionNormalLluvia(),
  ])

  return (
    <div className="space-y-6">
      <ZonasComparisonSection zonas={zonas} />
      <DistribucionProbabilidadChart rows={distribucion} />
    </div>
  )
}
