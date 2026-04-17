'use client'

// Simulates corn growth stage based on days since planting
// 6 stages: 0-20, 21-40, 41-60, 61-80, 81-100, 100+
const STAGES = [
  { label: 'Germinación', emoji: '🌱', days: '0–20 días', color: 'bg-lime-100 text-lime-700' },
  { label: 'Plántula', emoji: '🌿', days: '21–40 días', color: 'bg-green-100 text-green-700' },
  { label: 'Crecimiento', emoji: '🌾', days: '41–60 días', color: 'bg-emerald-100 text-emerald-700' },
  { label: 'Elongación', emoji: '🌵', days: '61–80 días', color: 'bg-teal-100 text-teal-700' },
  { label: 'Floración', emoji: '🌻', days: '81–100 días', color: 'bg-yellow-100 text-yellow-700' },
  { label: 'Maduración', emoji: '🌽', days: '100+ días', color: 'bg-orange-100 text-orange-700' },
]

function getStage(dias: number) {
  if (dias < 0) return STAGES[0]
  if (dias <= 20) return STAGES[0]
  if (dias <= 40) return STAGES[1]
  if (dias <= 60) return STAGES[2]
  if (dias <= 80) return STAGES[3]
  if (dias <= 100) return STAGES[4]
  return STAGES[5]
}

export default function CornGrowthSimulator({ diasDesde }: { diasDesde: number }) {
  const stage = getStage(diasDesde)

  return (
    <div className={`flex flex-col items-center justify-center rounded-xl p-5 min-w-[120px] ${stage.color}`}>
      <span className="text-5xl mb-2">{stage.emoji}</span>
      <p className="font-semibold text-sm">{stage.label}</p>
      <p className="text-xs opacity-70 mt-0.5">{stage.days}</p>
    </div>
  )
}
