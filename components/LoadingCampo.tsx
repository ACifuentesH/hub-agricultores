/**
 * Animación de carga de marca: una planta de maíz que germina y crece.
 *
 * Por qué SVG+CSS y no un video/GIF generado: esto se muestra JUSTO cuando la
 * app está esperando datos, así que debe pesar prácticamente nada (~1 KB),
 * pintarse en el primer frame y no competir por ancho de banda con la consulta
 * que estamos esperando. Además escala nítido en cualquier pantalla y se adapta
 * al modo oscuro.
 *
 * Accesibilidad: el bucle se detiene con `prefers-reduced-motion` y el estado
 * se anuncia por `role="status"`.
 */
export default function LoadingCampo({
  mensaje = 'Cargando datos del campo…',
  size = 56,
}: {
  mensaje?: string
  size?: number
}) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-10">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="lc-svg overflow-visible"
      >
        {/* suelo */}
        <line
          x1="12" y1="56" x2="52" y2="56"
          stroke="currentColor"
          className="text-green-900/25 dark:text-emerald-200/20"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* sol: late suavemente detrás de la planta */}
        <circle cx="48" cy="14" r="6" className="lc-sun fill-amber-400/80 dark:fill-amber-300/70" />

        {/* tallo: se dibuja de abajo hacia arriba */}
        <path
          d="M32 56 C32 44, 32 34, 32 22"
          className="lc-stem stroke-green-700 dark:stroke-emerald-400"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* hojas: se despliegan escalonadas */}
        <path
          d="M32 42 C24 40, 19 35, 17 29"
          className="lc-leaf lc-leaf-1 stroke-green-600 dark:stroke-emerald-300"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M32 34 C40 32, 45 27, 47 21"
          className="lc-leaf lc-leaf-2 stroke-green-600 dark:stroke-emerald-300"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M32 26 C26 24, 22 20, 21 15"
          className="lc-leaf lc-leaf-3 stroke-green-500 dark:stroke-emerald-200"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      <p className="text-xs text-gray-500 dark:text-gray-400">{mensaje}</p>

      <style>{`
        .lc-svg .lc-stem {
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          animation: lcGrow 2.2s ease-in-out infinite;
        }
        .lc-svg .lc-leaf {
          stroke-dasharray: 16;
          stroke-dashoffset: 16;
          animation: lcGrow 2.2s ease-in-out infinite;
        }
        .lc-svg .lc-leaf-1 { animation-delay: .45s }
        .lc-svg .lc-leaf-2 { animation-delay: .65s }
        .lc-svg .lc-leaf-3 { animation-delay: .85s }
        .lc-svg .lc-sun {
          transform-origin: 48px 14px;
          animation: lcSun 2.2s ease-in-out infinite;
        }
        @keyframes lcGrow {
          0%        { stroke-dashoffset: var(--lc-len, 40) }
          45%, 78%  { stroke-dashoffset: 0 }
          100%      { stroke-dashoffset: 0; opacity: 0 }
        }
        @keyframes lcSun {
          0%, 100% { transform: scale(.9); opacity: .55 }
          50%      { transform: scale(1.05); opacity: 1 }
        }
        @media (prefers-reduced-motion: reduce) {
          .lc-svg .lc-stem,
          .lc-svg .lc-leaf { animation: none; stroke-dashoffset: 0 }
          .lc-svg .lc-sun  { animation: none; opacity: .9 }
        }
      `}</style>
    </div>
  )
}
