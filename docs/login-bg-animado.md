# Fondo animado del login — instrucciones de implementación

Repo: `perez-luis-netizen/agri-platform` · rama `main`
Archivos a tocar: `app/globals.css` y `app/(auth)/login/page.tsx`

Objetivo: animar el panel de marca (izquierda) del login sin cambiar el layout,
la tipografía ni el formulario. Todo es CSS; no se agregan dependencias.

---

## 1. `app/globals.css` — añadir keyframes al final del archivo

Ya existen `sway`, `sway-slow`, `drift` y `.particle`. Añadir debajo:

```css
/* ── Login: fondo animado del panel de marca ─────────────────────── */
@keyframes bgKenBurns {
  0%   { transform: scale(1.06) translate3d(0, 0, 0); }
  50%  { transform: scale(1.18) translate3d(-2.2%, -1.6%, 0); }
  100% { transform: scale(1.06) translate3d(0, 0, 0); }
}
@keyframes lightSweep {
  0%   { transform: translate3d(-18%, 6%, 0) scale(1);    opacity: .55; }
  50%  { transform: translate3d(14%, -8%, 0) scale(1.25); opacity: .9; }
  100% { transform: translate3d(-18%, 6%, 0) scale(1);    opacity: .55; }
}
@keyframes hazeDrift {
  0%   { transform: translate3d(0, 0, 0);     opacity: .35; }
  50%  { transform: translate3d(6%, -3%, 0);  opacity: .6; }
  100% { transform: translate3d(0, 0, 0);     opacity: .35; }
}
@keyframes moteFloat {
  0%   { transform: translate3d(0, 10vh, 0) scale(.8);    opacity: 0; }
  12%  { opacity: .9; }
  80%  { opacity: .55; }
  100% { transform: translate3d(6vw, -85vh, 0) scale(1.15); opacity: 0; }
}
@keyframes fieldSway {
  0%   { transform: skewX(0deg) translate3d(0, 0, 0); }
  50%  { transform: skewX(1.1deg) translate3d(-1.5%, 0, 0); }
  100% { transform: skewX(0deg) translate3d(0, 0, 0); }
}

.login-kenburns  { animation: bgKenBurns 34s ease-in-out infinite; will-change: transform; }
.login-sweep     { animation: lightSweep 22s ease-in-out infinite; will-change: transform, opacity; }
.login-haze      { animation: hazeDrift 28s ease-in-out infinite; animation-delay: -8s; }
.login-field     { animation: fieldSway 16s ease-in-out infinite; transform-origin: bottom center; }
.login-mote      { animation: moteFloat 19s linear infinite; }

/* El botón/switch de la UI apaga todo con data-anim="off" */
[data-anim="off"] * { animation: none !important; }

@media (prefers-reduced-motion: reduce) {
  .login-kenburns, .login-sweep, .login-haze, .login-field, .login-mote { animation: none; }
}
```

---

## 2. `app/(auth)/login/page.tsx`

### 2.1 Estado del switch (junto a los `useState` existentes)

```tsx
const [anim, setAnim] = useState(true)
```

### 2.2 Contenedor raíz — añadir `data-anim`

```diff
-    <div className="min-h-screen grid lg:grid-cols-5 bg-white dark:bg-gray-950">
+    <div data-anim={anim ? 'on' : 'off'} className="min-h-screen grid lg:grid-cols-5 bg-white dark:bg-gray-950">
```

### 2.3 Panel de marca — reemplazar el div del `backgroundImage` y su overlay

Antes:

```tsx
<div
  className="relative lg:col-span-3 hidden lg:flex flex-col justify-between p-12 text-white bg-cover bg-center"
  style={{ backgroundImage: "url('/login-bg.jpg')" }}
>
  <div className="absolute inset-0 bg-gradient-to-br from-green-950/80 via-green-900/50 to-emerald-950/85" />
```

Después (la imagen pasa a una capa propia que puede escalar sin mover el contenido;
`overflow-hidden` + `isolate` contienen el zoom y los blend modes):

```tsx
<div className="relative lg:col-span-3 hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden isolate bg-green-950">
  {/* Capa 1 — foto con Ken Burns */}
  <div
    className="absolute -inset-[6%] z-0 bg-cover bg-center login-kenburns"
    style={{ backgroundImage: "url('/login-bg.jpg')" }}
  />

  {/* Capa 2 — degradado de marca (mismas opacidades que hoy) */}
  <div className="absolute inset-0 z-[1] bg-gradient-to-br from-green-950/80 via-green-900/50 to-emerald-950/85" />

  {/* Capa 3 — barrido de luz verde-lima */}
  <div
    className="absolute -inset-[30%] z-[2] blur-2xl mix-blend-screen login-sweep"
    style={{
      background:
        'radial-gradient(45% 40% at 30% 35%, rgba(163,230,53,.30) 0%, rgba(34,197,94,.12) 40%, transparent 72%)',
    }}
  />

  {/* Capa 4 — neblina ámbar */}
  <div
    className="absolute -inset-[20%] z-[2] blur-3xl mix-blend-screen login-haze"
    style={{
      background: 'radial-gradient(50% 45% at 72% 78%, rgba(234,179,8,.22) 0%, transparent 68%)',
    }}
  />

  {/* Capa 5 — base del campo con vaivén */}
  <div className="absolute inset-x-0 bottom-0 h-[34%] z-[2] bg-gradient-to-t from-green-950/70 to-transparent login-field" />

  {/* Capa 6 — partículas de polen */}
  <div className="absolute inset-0 z-[3] pointer-events-none overflow-hidden">
    {[
      { left: '12%', size: 5, dur: 19, delay: 0,   color: 'rgba(214,255,180,.9)',  glow: true },
      { left: '28%', size: 3, dur: 26, delay: -6,  color: 'rgba(255,244,200,.85)', glow: false },
      { left: '44%', size: 6, dur: 23, delay: -13, color: 'rgba(190,250,160,.7)',  glow: true },
      { left: '61%', size: 4, dur: 30, delay: -3,  color: 'rgba(255,255,255,.75)', glow: false },
      { left: '78%', size: 3, dur: 21, delay: -17, color: 'rgba(253,230,138,.9)',  glow: false },
      { left: '88%', size: 5, dur: 27, delay: -9,  color: 'rgba(214,255,180,.6)',  glow: true },
    ].map((m, i) => (
      <span
        key={i}
        className="absolute rounded-full login-mote"
        style={{
          left: m.left,
          bottom: '-4%',
          width: m.size,
          height: m.size,
          background: m.color,
          boxShadow: m.glow ? '0 0 15px rgba(132,204,22,.45)' : undefined,
          animationDuration: `${m.dur}s`,
          animationDelay: `${m.delay}s`,
        }}
      />
    ))}
  </div>

  {/* Capa 7 — viñeta */}
  <div
    className="absolute inset-0 z-[4] pointer-events-none"
    style={{ boxShadow: 'inset 0 0 160px 40px rgba(2,26,12,.55)' }}
  />
```

**Importante:** el contenido existente (logo, `<h1>`, stats, ©) ya usa `relative z-10`,
así que queda por encima de todas las capas sin cambios. Solo hay que cerrar el div
del panel igual que hoy.

### 2.4 Switch para activar/desactivar animaciones

Colocar dentro del panel de marca, como último hijo (antes de cerrar el div):

```tsx
<button
  type="button"
  onClick={() => setAnim((v) => !v)}
  aria-pressed={anim}
  className="absolute bottom-11 right-12 z-[6] inline-flex items-center gap-[7px] rounded px-[9px] py-[5px] text-[10px] font-medium tracking-wide text-white/85 border border-white/20 bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20 hover:border-white/40"
>
  <span
    className="relative w-[22px] h-3 rounded-[3px] border border-white/30 shrink-0 transition-colors"
    style={{ background: anim ? 'rgba(163,230,53,.25)' : 'rgba(255,255,255,.12)' }}
  >
    <span
      className="absolute top-px w-2 h-2 rounded-[2px] transition-all"
      style={{
        left: anim ? 11 : 1,
        background: anim ? '#a3e635' : 'rgba(255,255,255,.5)',
      }}
    />
  </span>
  {anim ? 'Animación activada' : 'Animación desactivada'}
</button>
```

---

## 3. Notas

- No cambia el formulario, el copy ni las rutas de auth.
- `login-bg.jpg` sigue siendo el mismo asset de `public/`.
- Rendimiento: solo se animan `transform` y `opacity` (compuestas en GPU).
  Los `blur` grandes están en capas de `-inset` para que no se vean los bordes.
- Accesibilidad: respeta `prefers-reduced-motion` y el switch persiste solo en
  memoria; si quieres persistirlo, guarda `anim` en `localStorage`.

Referencia visual: `Login Animado.dc.html` en el proyecto de diseño.
