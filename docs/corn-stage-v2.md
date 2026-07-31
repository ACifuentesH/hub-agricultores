# CornStage v2 — plantas de maíz redibujadas

Repo: `perez-luis-netizen/agri-platform` · rama `main`
Archivos: `components/CornStage.tsx` (reemplazo completo) y `components/CultivoTimeline.tsx` (1 cambio menor)

Referencia visual: `Plantas Maiz v2.dc.html` · diagnóstico: `Revision Plantas Maiz.dc.html`

## Qué cambia y por qué

| # | Problema en v1 | Corrección v2 |
|---|---|---|
| 1 | Etapa R1–R4 asimétrica (faltaba la hoja derecha de `y=50`) | Todas las etapas tienen pares de hojas completos |
| 2 | V0 medía ~6 px a 48 px, ilegible | V0 sube a 10 u de alto con hojas anchas y cotiledón |
| 3 | Alturas 12→24→44→64→70→70 (salto + meseta) | 10→26→46→62→68→70: progresión pareja, R6 > R1–R4 |
| 4 | Mazorca cruzando hojas, sin anclaje | Pedúnculo del tallo + mazorca en el hueco entre nodos (y 47–63) |
| 5 | Hojas como `stroke` de grosor constante (alambre) | Paths rellenos ahusados: anchos en la base, en punta al final |
| 6 | `#d4d4aa` / `#d4a574` fuera de paleta | `#fde68a` (corn-300) espiga fresca, `#ca8a04` (corn-600) seca |
| 7 | `cornGrow` animaba solo `scaleY` (aplasta) | `scale()` uniforme desde .62 + fade, easing sin overshoot |
| 8 | Cada planta dibujaba su propia línea de suelo | Suelo fuera del SVG, una sola línea en la timeline |

Se mantiene el `viewBox="0 0 64 96"`, el `transform-origin: 50% 100%` y la API del componente
(`stage`, `size`, `active`), así que no hay que tocar nada más de la timeline.

---

## 1. `app/globals.css` — reemplazar el keyframe de crecimiento

```css
/* reemplaza cornGrow */
@keyframes cornGrowV2 {
  from { transform: scale(.62) translateY(6px); opacity: 0; }
  to   { transform: scale(1) translateY(0);     opacity: 1; }
}
@keyframes leafSwayV2 {
  0%, 100% { transform: rotate(-1.2deg); }
  50%      { transform: rotate(1.2deg); }
}
@media (prefers-reduced-motion: reduce) {
  .corn-stage { animation: none !important; }
}
```

---

## 2. `components/CornStage.tsx` — reemplazo completo

```tsx
'use client'

type Props = {
  /** 0 = V0 germinación … 5 = R6 madurez */
  stage: number
  /** ancho en px; la altura es 1.5× (viewBox 64×96) */
  size?: number
  /** etapa actual del lote: full opacity + glow */
  active?: boolean
  /** retardo de la animación de entrada, en ms */
  delay?: number
}

const STAGES: React.ReactNode[] = [
  // ── 0 · V0 · Germinación (alto 10) ──────────────────────────────
  <>
    <path d="M32 92 L32 82" stroke="#65a30d" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M32 84.4 Q25 78 18 81 Q25 86 32 87.6 Z" fill="#84cc16" />
    <path d="M32 84.4 Q39 78 46 81 Q39 86 32 87.6 Z" fill="#a3e635" />
    <path d="M32 82 Q29.5 78 32 74 Q34.5 78 32 82 Z" fill="#a3e635" />
  </>,

  // ── 1 · V3–V6 · Establecimiento (alto 26) ───────────────────────
  <>
    <path d="M32 92 L32 66" stroke="#15803d" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M32 80.2 Q23.5 72 15 75 Q23.5 79 32 83.8 Z" fill="#16a34a" />
    <path d="M32 80.2 Q40.5 72 49 75 Q40.5 79 32 83.8 Z" fill="#16a34a" />
    <path d="M32 70.2 Q25.5 61 19 64 Q25.5 68 32 73.8 Z" fill="#22c55e" />
    <path d="M32 70.2 Q38.5 61 45 64 Q38.5 68 32 73.8 Z" fill="#22c55e" />
    <path d="M32 67 Q28.5 60 32 54 Q35.5 60 32 67 Z" fill="#4ade80" />
  </>,

  // ── 2 · V7–V10 · Crecimiento (alto 46) ──────────────────────────
  <>
    <path d="M32 92 L32 46" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
    <path d="M32 84.2 Q20 76 8 79 Q20 83 32 87.8 Z" fill="#15803d" />
    <path d="M32 84.2 Q44 76 56 79 Q44 83 32 87.8 Z" fill="#15803d" />
    <path d="M32 72.2 Q21.5 63 11 66 Q21.5 70 32 75.8 Z" fill="#16a34a" />
    <path d="M32 72.2 Q42.5 63 53 66 Q42.5 70 32 75.8 Z" fill="#16a34a" />
    <path d="M32 58.2 Q24.5 49 17 52 Q24.5 56 32 61.8 Z" fill="#22c55e" />
    <path d="M32 58.2 Q39.5 49 47 52 Q39.5 56 32 61.8 Z" fill="#22c55e" />
    <path d="M32 47 Q28 39 32 32 Q36 39 32 47 Z" fill="#4ade80" />
  </>,

  // ── 3 · V12–VT · Floración (alto 62 + espiga) ───────────────────
  <>
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
  </>,

  // ── 4 · R1–R4 · Llenado (alto 68, mazorca verde con barbas) ─────
  <>
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
  </>,

  // ── 5 · R6 · Madurez (alto 70, mazorca con granos) ──────────────
  <>
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
  </>,
]

export default function CornStage({ stage, size = 48, active = false, delay = 0 }: Props) {
  const i = Math.max(0, Math.min(STAGES.length - 1, stage))
  return (
    <svg
      viewBox="0 0 64 96"
      width={size}
      height={size * 1.5}
      className="corn-stage overflow-visible"
      style={{
        transformOrigin: '50% 100%',
        animation: `cornGrowV2 760ms cubic-bezier(.16,1,.3,1) ${delay}ms both`,
        opacity: active ? 1 : 0.45,
        filter: active
          ? 'drop-shadow(0 0 8px rgba(132,204,22,.6))'
          : 'grayscale(.4)',
      }}
      aria-hidden="true"
    >
      {STAGES[i]}
    </svg>
  )
}
```

> Si en v1 `CornStage` era un named export o recibía la etapa como string
> (`'V0' | 'V3-V6' | …`), conserva esa firma y usa un mapa `stage → índice`;
> lo único que debe cambiar son los paths y el `<svg>` wrapper.

---

## 3. `components/CultivoTimeline.tsx` — suelo único

El suelo ya no viene dentro de cada SVG: agrégalo una vez debajo de la fila de plantas.

```diff
- <div className="flex items-end justify-between px-6">
-   {stages.map((s, i) => <CornStage key={i} stage={i} active={i === currentStage} />)}
- </div>
+ <div className="relative">
+   <div className="flex items-end justify-between px-6">
+     {stages.map((s, i) => (
+       <CornStage key={i} stage={i} active={i === currentStage} delay={i * 120} />
+     ))}
+   </div>
+   <div
+     className="h-px"
+     style={{
+       background:
+         'linear-gradient(to right, transparent, rgba(120,53,15,.9) 8%, rgba(120,53,15,.9) 92%, transparent)',
+     }}
+   />
+ </div>
```

---

## 4. Checklist de QA

- [ ] Las 6 etapas crecen de forma monótona (ninguna más baja que la anterior).
- [ ] Ninguna hoja queda sin par (salvo el cotiledón central de V0/V3/V7).
- [ ] La mazorca no cruza ninguna hoja en R1–R4 ni en R6.
- [ ] A 48 px se distingue la silueta de las 6 etapas sobre fondo oscuro.
- [ ] Con `prefers-reduced-motion` las plantas aparecen sin animación.
- [ ] No quedan `#d4d4aa` ni `#d4a574` en el archivo.
