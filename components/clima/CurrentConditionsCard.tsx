'use client'

/**
 * Piloto HeroUI v3 — tarjeta "Lectura más reciente" de /clima.
 *
 * Es el primer componente de la app migrado a HeroUI v3 (Card + Chip). El resto
 * de la pantalla sigue con los componentes propios de Tailwind; si el piloto
 * convence, se amplía. Para revertir: volver a inlinear este bloque en
 * app/(app)/clima/page.tsx y quitar el @import de @heroui/styles en globals.css.
 */

import { Card, Chip } from '@heroui/react'
import { Thermometer, Droplets, CloudRain, MapPin } from 'lucide-react'
import type { CurrentConditions } from '@/lib/clima'
import { formatDateShort, freshnessLevel } from '@/lib/freshness'

type ChipColor = 'success' | 'warning' | 'danger' | 'default'

const FRESHNESS_CHIP_COLOR: Record<
  ReturnType<typeof freshnessLevel>,
  ChipColor
> = {
  fresh: 'success',
  warn: 'warning',
  stale: 'danger',
  missing: 'default',
}

export default function CurrentConditionsCard({
  conditions,
}: {
  conditions: CurrentConditions
}) {
  // Se renderiza solo cuando hay lectura de temperatura (davis o triangulada).
  if (conditions.tempC == null) return null

  const { source } = conditions
  const level = freshnessLevel(conditions.fecha)

  const origen =
    source.fuente === 'davis'
      ? source.davisKey ?? 'Davis'
      : source.fuente === 'triangulated'
        ? `IDW · ${source.nEstaciones ?? 0} est.`
        : 'Sin estación'

  return (
    <Card variant="default" className="w-full">
      <Card.Header className="flex flex-row flex-wrap items-center justify-between gap-3">
        <Card.Title className="text-sm font-semibold">Lectura más reciente</Card.Title>
        {conditions.fecha && (
          <Chip size="sm" variant="soft" color={FRESHNESS_CHIP_COLOR[level]}>
            {level === 'fresh'
              ? 'Actualizada'
              : `Última lectura: ${formatDateShort(conditions.fecha)}`}
          </Chip>
        )}
      </Card.Header>

      <Card.Content>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            icon={<Thermometer size={18} className="text-orange-500" />}
            label="Temperatura"
            value={`${conditions.tempC.toFixed(1)}°C`}
          />
          {conditions.humPct != null && (
            <Stat
              icon={<Droplets size={18} className="text-blue-500" />}
              label="Humedad"
              value={`${conditions.humPct.toFixed(0)}%`}
            />
          )}
          {conditions.lluviaMm != null && (
            <Stat
              icon={<CloudRain size={18} className="text-sky-500" />}
              label="Lluvia"
              value={`${conditions.lluviaMm.toFixed(1)} mm`}
            />
          )}
          <Stat
            icon={<MapPin size={18} className="text-green-600" />}
            label="Origen"
            value={origen}
          />
        </div>

        {source.fuente === 'triangulated' && source.estacionesUsadas && (
          <p className="mt-4 rounded border border-amber-200/50 bg-amber-50/50 p-2.5 text-[11px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            <strong>Estimación triangulada:</strong> {source.estacionesUsadas}.
            {source.precision && ` Precisión estimada: ${source.precision}.`}
          </p>
        )}
      </Card.Content>
    </Card>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 rounded-lg bg-gray-50 p-2 dark:bg-gray-800">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className="truncate text-base font-semibold text-gray-800 dark:text-gray-100">
          {value}
        </p>
      </div>
    </div>
  )
}
