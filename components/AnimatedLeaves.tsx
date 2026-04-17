export default function AnimatedLeaves() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Hojas grandes en las esquinas */}
      <svg
        className="absolute -bottom-4 -left-8 w-64 h-64 opacity-70 leaf-sway"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M100 190 Q60 120 80 40 Q100 80 100 190 Z"
          fill="url(#leaf1)"
        />
        <path
          d="M100 190 Q140 120 120 40 Q100 80 100 190 Z"
          fill="url(#leaf2)"
        />
        <path d="M100 190 L100 30" stroke="#1a4d1a" strokeWidth="2" />
        <defs>
          <linearGradient id="leaf1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5cb85c" />
            <stop offset="100%" stopColor="#1f6b1f" />
          </linearGradient>
          <linearGradient id="leaf2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7ec97e" />
            <stop offset="100%" stopColor="#2d8a2d" />
          </linearGradient>
        </defs>
      </svg>

      <svg
        className="absolute -bottom-8 -right-12 w-72 h-72 opacity-70 leaf-sway-slow"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path d="M100 190 Q50 130 70 30 Q100 90 100 190 Z" fill="url(#leaf3)" />
        <path d="M100 190 Q150 130 130 30 Q100 90 100 190 Z" fill="url(#leaf4)" />
        <path d="M100 190 L100 20" stroke="#1a4d1a" strokeWidth="2" />
        <defs>
          <linearGradient id="leaf3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6ec46e" />
            <stop offset="100%" stopColor="#2d6b2d" />
          </linearGradient>
          <linearGradient id="leaf4" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8ed98e" />
            <stop offset="100%" stopColor="#3a8a3a" />
          </linearGradient>
        </defs>
      </svg>

      {/* Hoja pequeña arriba-izquierda */}
      <svg
        className="absolute top-8 left-12 w-24 h-24 opacity-60 leaf-sway"
        style={{ animationDelay: '1.2s' }}
        viewBox="0 0 200 200"
        fill="none"
      >
        <path d="M100 190 Q70 120 85 50 Q100 80 100 190 Z" fill="#5cb85c" />
        <path d="M100 190 Q130 120 115 50 Q100 80 100 190 Z" fill="#7ec97e" />
        <path d="M100 190 L100 40" stroke="#1a4d1a" strokeWidth="1.5" />
      </svg>

      {/* Partículas (hojitas/polen flotando) */}
      <span
        className="particle absolute bottom-0 left-[15%] w-2 h-2 rounded-full bg-green-300/70"
        style={{ animationDelay: '0s' }}
      />
      <span
        className="particle absolute bottom-0 left-[35%] w-1.5 h-1.5 rounded-full bg-yellow-200/70"
        style={{ animationDelay: '4s' }}
      />
      <span
        className="particle absolute bottom-0 left-[60%] w-2 h-2 rounded-full bg-green-200/60"
        style={{ animationDelay: '8s' }}
      />
      <span
        className="particle absolute bottom-0 left-[80%] w-1.5 h-1.5 rounded-full bg-lime-200/60"
        style={{ animationDelay: '12s' }}
      />
    </div>
  )
}
