'use client'

import type { Stage } from '@/lib/corn-stages'
import { STAGE_META } from '@/lib/corn-stages'

interface Props {
  stage: Stage
  /** seconds delay before the plant grows-in (for staggered animation) */
  delay?: number
  /** width in px (height auto-scales) */
  size?: number
  className?: string
}

/**
 * Planta de maíz estilizada, por etapa fenológica (v2 — ver
 * `docs/corn-stage-v2.md`).
 *
 * Cambios respecto a la v1: hojas como paths rellenos y ahusados en vez de
 * trazos de grosor constante (parecían alambre), pares de hojas completos en
 * todas las etapas, alturas que crecen de forma monótona (10→26→46→62→68→70,
 * sin el salto ni la meseta que tenía antes) y la mazorca alojada en el hueco
 * entre nodos con su pedúnculo, en vez de cruzada sobre las hojas.
 *
 * **La línea de suelo ya no va dentro del SVG**: la dibuja la timeline una
 * sola vez debajo de la fila de plantas. Seis líneas superpuestas con distinta
 * opacidad se notaban como escalones.
 *
 * **El estado (pasada / actual / futura) lo aplica quien lo usa**, no este
 * componente: la timeline distingue tres casos y aquí solo cabrían dos, así
 * que las etapas ya recorridas se verían apagadas igual que las futuras.
 */
export default function CornStage({ stage, delay = 0, size = 64, className = '' }: Props) {
  return (
    <div
      className={`inline-block ${className}`}
      style={{ width: size }}
      aria-label={`Etapa ${STAGE_META[stage].label} — ${STAGE_META[stage].phase}`}
    >
      <svg
        viewBox="0 0 64 96"
        width={size}
        height={size * 1.5}
        className="corn-stage overflow-visible"
        style={{
          transformOrigin: '50% 100%',
          // Escala uniforme, no solo scaleY: crecer estirando el eje vertical
          // aplastaba la planta durante toda la entrada.
          animation: `cornGrowV2 760ms cubic-bezier(.16,1,.3,1) ${delay}s both`,
        }}
      >
        {renderStage(stage)}
      </svg>
    </div>
  )
}

function renderStage(stage: Stage) {
  switch (stage) {
    case 0: return <Stage0 />
    case 1: return <Stage1 />
    case 2: return <Stage2 />
    case 3: return <Stage3 />
    case 4: return <Stage4 />
    case 5: return <Stage5 />
  }
}

/* ───────── 0 · V0 · Germinación (alto 10) ───────── */
function Stage0() {
  return (
    <g>
      <path d="M32 92 L32 82" stroke="#65a30d" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M32 84.4 Q25 78 18 81 Q25 86 32 87.6 Z" fill="#84cc16" />
      <path d="M32 84.4 Q39 78 46 81 Q39 86 32 87.6 Z" fill="#a3e635" />
      <path d="M32 82 Q29.5 78 32 74 Q34.5 78 32 82 Z" fill="#a3e635" />
    </g>
  )
}

/* ───────── 1 · V3–V6 · Establecimiento (alto 26) ───────── */
function Stage1() {
  return (
    <g>
      <path d="M32 92 L32 66" stroke="#15803d" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M32 80.2 Q23.5 72 15 75 Q23.5 79 32 83.8 Z" fill="#16a34a" />
      <path d="M32 80.2 Q40.5 72 49 75 Q40.5 79 32 83.8 Z" fill="#16a34a" />
      <path d="M32 70.2 Q25.5 61 19 64 Q25.5 68 32 73.8 Z" fill="#22c55e" />
      <path d="M32 70.2 Q38.5 61 45 64 Q38.5 68 32 73.8 Z" fill="#22c55e" />
      <path d="M32 67 Q28.5 60 32 54 Q35.5 60 32 67 Z" fill="#4ade80" />
    </g>
  )
}

/* ───────── 2 · V7–V10 · Crecimiento (alto 46) ───────── */
function Stage2() {
  return (
    <g>
      <path d="M32 92 L32 46" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 84.2 Q20 76 8 79 Q20 83 32 87.8 Z" fill="#15803d" />
      <path d="M32 84.2 Q44 76 56 79 Q44 83 32 87.8 Z" fill="#15803d" />
      <path d="M32 72.2 Q21.5 63 11 66 Q21.5 70 32 75.8 Z" fill="#16a34a" />
      <path d="M32 72.2 Q42.5 63 53 66 Q42.5 70 32 75.8 Z" fill="#16a34a" />
      <path d="M32 58.2 Q24.5 49 17 52 Q24.5 56 32 61.8 Z" fill="#22c55e" />
      <path d="M32 58.2 Q39.5 49 47 52 Q39.5 56 32 61.8 Z" fill="#22c55e" />
      <path d="M32 47 Q28 39 32 32 Q36 39 32 47 Z" fill="#4ade80" />
    </g>
  )
}

/* ───────── 3 · V12–VT · Floración (alto 62 + espiga) ───────── */
function Stage3() {
  return (
    <g>
      <path d="M32 92 L32 30" stroke="#166534" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M32 84.2 Q18.5 76 5 79 Q18.5 83 32 87.8 Z" fill="#14532d" />
      <path d="M32 84.2 Q45.5 76 59 79 Q45.5 83 32 87.8 Z" fill="#14532d" />
      <path d="M32 70.2 Q19.5 61 7 64 Q19.5 68 32 73.8 Z" fill="#166534" />
      <path d="M32 70.2 Q44.5 61 57 64 Q44.5 68 32 73.8 Z" fill="#166534" />
      <path d="M32 56.2 Q22.5 47 13 50 Q22.5 54 32 59.8 Z" fill="#15803d" />
      <path d="M32 56.2 Q41.5 47 51 50 Q41.5 54 32 59.8 Z" fill="#15803d" />
      <path d="M32 42.2 Q25.5 34 19 37 Q25.5 41 32 45.8 Z" fill="#22c55e" />
      <path d="M32 42.2 Q38.5 34 45 37 Q38.5 41 32 45.8 Z" fill="#22c55e" />
      {/* espiga (tassel) fresca */}
      <path d="M32 30 L32 13" stroke="#fde68a" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M32 30 Q26 23 24 15" stroke="#fde68a" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M32 30 Q38 23 40 15" stroke="#fde68a" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <circle cx="32" cy="13" r="1.3" fill="#eab308" />
      <circle cx="24" cy="15" r="1.1" fill="#eab308" />
      <circle cx="40" cy="15" r="1.1" fill="#eab308" />
    </g>
  )
}

/* ───────── 4 · R1–R4 · Llenado (alto 68, mazorca verde con barbas) ───────── */
function Stage4() {
  return (
    <g>
      <path d="M32 92 L32 24" stroke="#166534" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M32 84.2 Q18 76 4 79 Q18 83 32 87.8 Z" fill="#14532d" />
      <path d="M32 84.2 Q46 76 60 79 Q46 83 32 87.8 Z" fill="#14532d" />
      <path d="M32 68.2 Q19.5 59 7 62 Q19.5 66 32 71.8 Z" fill="#166534" />
      <path d="M32 68.2 Q44.5 59 57 62 Q44.5 66 32 71.8 Z" fill="#166534" />
      {/* pedúnculo + mazorca alojada entre nodos */}
      <path d="M32 62 Q36.5 61 39.5 58.5" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none" />
      <ellipse cx="43" cy="55" rx="4.2" ry="8.5" fill="#84cc16" transform="rotate(22 43 55)" />
      <path d="M41.5 48.5 Q43.5 55 42.5 62" stroke="#a3e635" strokeWidth=".9" fill="none" />
      <path d="M45 49.5 Q47 55.5 45.5 62.5" stroke="#a3e635" strokeWidth=".9" fill="none" />
      {/* barbas (silks) */}
      <path d="M44 47 Q47 43 50 42" stroke="#fde68a" strokeWidth=".9" strokeLinecap="round" fill="none" />
      <path d="M44.5 47 Q48.5 45 52 45.5" stroke="#fde68a" strokeWidth=".9" strokeLinecap="round" fill="none" />
      <path d="M32 42.2 Q24.5 34 17 37 Q24.5 41 32 45.8 Z" fill="#15803d" />
      <path d="M32 42.2 Q39.5 34 47 37 Q39.5 41 32 45.8 Z" fill="#15803d" />
      <path d="M32 32.2 Q27 25 22 28 Q27 32 32 35.8 Z" fill="#22c55e" />
      <path d="M32 32.2 Q37 25 42 28 Q37 32 32 35.8 Z" fill="#22c55e" />
      <path d="M32 24 L32 8" stroke="#ca8a04" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M32 24 Q26 17 24 10" stroke="#ca8a04" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M32 24 Q38 17 40 10" stroke="#ca8a04" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <circle cx="32" cy="8" r="1.3" fill="#a16207" />
    </g>
  )
}

/* ───────── 5 · R6 · Madurez (alto 70, mazorca con granos) ───────── */
function Stage5() {
  return (
    <g>
      <path d="M32 92 L32 22" stroke="#854d0e" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M32 84.2 Q18 80 4 86 Q18 87 32 87.8 Z" fill="#854d0e" />
      <path d="M32 84.2 Q46 80 60 86 Q46 87 32 87.8 Z" fill="#854d0e" />
      <path d="M32 68.2 Q19.5 64 7 70 Q19.5 71 32 71.8 Z" fill="#a16207" />
      <path d="M32 68.2 Q44.5 64 57 70 Q44.5 71 32 71.8 Z" fill="#a16207" />
      <path d="M32 62 Q36.5 61 39.5 58.5" stroke="#854d0e" strokeWidth="2" strokeLinecap="round" fill="none" />
      <ellipse cx="43" cy="55" rx="4.8" ry="9" fill="#eab308" transform="rotate(20 43 55)" />
      <g transform="rotate(20 43 55)" fill="#fef3c7">
        <circle cx="43" cy="49" r=".75" />
        <circle cx="41" cy="51.5" r=".75" />
        <circle cx="45" cy="51.5" r=".75" />
        <circle cx="43" cy="54" r=".75" />
        <circle cx="41" cy="56.5" r=".75" />
        <circle cx="45" cy="56.5" r=".75" />
        <circle cx="43" cy="59" r=".75" />
        <circle cx="41" cy="61.5" r=".75" />
        <circle cx="45" cy="61.5" r=".75" />
      </g>
      {/* brácteas secas abiertas */}
      <path d="M40 47.5 Q35 54 36.5 62" stroke="#ca8a04" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M46.5 47.5 Q51.5 54 50 62" stroke="#ca8a04" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M32 42.2 Q25 36 18 40 Q25 42 32 45.8 Z" fill="#a16207" />
      <path d="M32 42.2 Q39 36 46 40 Q39 42 32 45.8 Z" fill="#a16207" />
      <path d="M32 22 L32 10" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M32 22 Q27 17 25 11" stroke="#92400e" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M32 22 Q37 17 39 11" stroke="#92400e" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </g>
  )
}
