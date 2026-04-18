export type Stage = 0 | 1 | 2 | 3 | 4 | 5

export const STAGE_META: { label: string; range: string; phase: string }[] = [
  { label: 'V0',     range: '0–10 d',    phase: 'Germinación' },
  { label: 'V3–V6',  range: '10–30 d',   phase: 'Establecimiento' },
  { label: 'V7–V10', range: '30–55 d',   phase: 'Crecimiento' },
  { label: 'V12–VT', range: '55–75 d',   phase: 'Floración' },
  { label: 'R1–R4',  range: '75–105 d',  phase: 'Llenado de grano' },
  { label: 'R6',     range: '105+ d',    phase: 'Madurez' },
]

export function getStageFromDays(dias: number): Stage {
  if (dias < 10)  return 0
  if (dias < 30)  return 1
  if (dias < 55)  return 2
  if (dias < 75)  return 3
  if (dias < 105) return 4
  return 5
}

export function getStageMeta(stage: Stage) {
  return STAGE_META[stage]
}

export function getCurrentStageInfo(fechaSiembra: string | null) {
  if (!fechaSiembra) return null
  const dias = Math.floor((Date.now() - new Date(fechaSiembra).getTime()) / 86400000)
  const stage = getStageFromDays(dias)
  return { dias, stage, meta: getStageMeta(stage) }
}
