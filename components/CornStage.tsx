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
 * Stylized SVG of a corn plant at a given growth stage.
 * Animates a vertical scale from 0 → 1, anchored to the soil line.
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
        className="overflow-visible"
        style={{
          transformOrigin: '50% 100%',
          animation: `cornGrow 700ms cubic-bezier(0.34, 1.4, 0.64, 1) ${delay}s both`,
        }}
      >
        {/* soil baseline */}
        <line x1="4" y1="92" x2="60" y2="92" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />

        {renderStage(stage)}
      </svg>

      <style jsx>{`
        @keyframes cornGrow {
          from { transform: scaleY(0); opacity: 0; }
          to   { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
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

/* ───────── Stage 0 — V0 Germinación: tiny sprout ───────── */
function Stage0() {
  return (
    <g>
      <path d="M32 92 Q30 85 28 80" stroke="#65a30d" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M32 92 Q34 85 36 80" stroke="#65a30d" strokeWidth="2" strokeLinecap="round" fill="none" />
      <ellipse cx="28" cy="80" rx="3" ry="1.5" fill="#84cc16" transform="rotate(-30 28 80)" />
      <ellipse cx="36" cy="80" rx="3" ry="1.5" fill="#84cc16" transform="rotate(30 36 80)" />
    </g>
  )
}

/* ───────── Stage 1 — V3-V6 Establecimiento: small plant, a few leaves ───────── */
function Stage1() {
  return (
    <g>
      {/* stem */}
      <line x1="32" y1="92" x2="32" y2="68" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
      {/* leaves */}
      <path d="M32 80 Q22 76 16 78" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 80 Q42 76 48 78" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 72 Q24 66 20 64" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 72 Q40 66 44 64" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* top crown */}
      <path d="M32 68 Q30 64 32 60 Q34 64 32 68" fill="#22c55e" />
    </g>
  )
}

/* ───────── Stage 2 — V7-V10 Crecimiento: taller, fuller leaves ───────── */
function Stage2() {
  return (
    <g>
      <line x1="32" y1="92" x2="32" y2="48" stroke="#15803d" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 84 Q18 80 10 84" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 84 Q46 80 54 84" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 72 Q18 66 12 64" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 72 Q46 66 52 64" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 60 Q22 54 16 52" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 60 Q42 54 48 52" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 48 Q30 44 32 40 Q34 44 32 48" fill="#22c55e" />
    </g>
  )
}

/* ───────── Stage 3 — V12-VT Floración: tall, tassel on top ───────── */
function Stage3() {
  return (
    <g>
      <line x1="32" y1="92" x2="32" y2="28" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 86 Q16 82 6 86" stroke="#166534" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 86 Q48 82 58 86" stroke="#166534" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 72 Q16 66 8 64" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 72 Q48 66 56 64" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 56 Q20 50 14 48" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 56 Q44 50 50 48" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 40 Q24 34 20 32" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M32 40 Q40 34 44 32" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* tassel */}
      <path d="M32 28 Q28 22 26 16" stroke="#d4d4aa" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M32 28 Q36 22 38 16" stroke="#d4d4aa" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M32 28 L32 14" stroke="#d4d4aa" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="14" r="1.5" fill="#eab308" />
      <circle cx="26" cy="16" r="1.2" fill="#eab308" />
      <circle cx="38" cy="16" r="1.2" fill="#eab308" />
    </g>
  )
}

/* ───────── Stage 4 — R1-R4 Llenado: tassel + green cob developing ───────── */
function Stage4() {
  return (
    <g>
      <line x1="32" y1="92" x2="32" y2="22" stroke="#166534" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M32 86 Q14 82 4 86" stroke="#166534" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 86 Q50 82 60 86" stroke="#166534" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 70 Q16 64 8 62" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 70 Q48 64 56 62" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      {/* green cob with husk */}
      <ellipse cx="42" cy="58" rx="4" ry="8" fill="#84cc16" transform="rotate(20 42 58)" />
      <path d="M40 50 L46 56" stroke="#a3e635" strokeWidth="1" />
      <path d="M44 50 L48 58" stroke="#a3e635" strokeWidth="1" />
      <path d="M32 50 Q22 44 16 42" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 38 Q24 32 20 30" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M32 38 Q40 32 44 30" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* tassel */}
      <path d="M32 22 Q28 16 26 10" stroke="#d4a574" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M32 22 Q36 16 38 10" stroke="#d4a574" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M32 22 L32 8" stroke="#d4a574" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="8" r="1.5" fill="#a16207" />
    </g>
  )
}

/* ───────── Stage 5 — R6 Madurez: golden mature corn ───────── */
function Stage5() {
  return (
    <g>
      <line x1="32" y1="92" x2="32" y2="22" stroke="#854d0e" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M32 86 Q14 84 4 88" stroke="#a16207" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 86 Q50 84 60 88" stroke="#a16207" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 70 Q16 68 8 70" stroke="#a16207" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 70 Q48 68 56 70" stroke="#a16207" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* mature golden cob with kernels */}
      <ellipse cx="42" cy="56" rx="5" ry="10" fill="#eab308" transform="rotate(20 42 56)" />
      <g transform="rotate(20 42 56)">
        <circle cx="42" cy="50" r="0.8" fill="#fef3c7" />
        <circle cx="40" cy="52" r="0.8" fill="#fef3c7" />
        <circle cx="44" cy="52" r="0.8" fill="#fef3c7" />
        <circle cx="42" cy="55" r="0.8" fill="#fef3c7" />
        <circle cx="40" cy="58" r="0.8" fill="#fef3c7" />
        <circle cx="44" cy="58" r="0.8" fill="#fef3c7" />
        <circle cx="42" cy="61" r="0.8" fill="#fef3c7" />
      </g>
      {/* dry husk */}
      <path d="M38 50 Q34 56 36 64" stroke="#ca8a04" strokeWidth="1.5" fill="none" />
      <path d="M46 50 Q50 56 48 64" stroke="#ca8a04" strokeWidth="1.5" fill="none" />
      <path d="M32 38 Q24 34 20 32" stroke="#a16207" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* dry tassel */}
      <path d="M32 22 Q28 18 26 14" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M32 22 Q36 18 38 14" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M32 22 L32 12" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  )
}
